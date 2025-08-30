import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Token pricing map based on payment amount
const TOKEN_PRICING_MAP: Record<string, number> = {
  '2.50': 10,
  '5.00': 22,
  '10.00': 45,
  '15.00': 69,
  '20.00': 94,
  '25.00': 120,
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('PayPal webhook received:', JSON.stringify(body, null, 2))

    // Handle payment completion
    if (body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const payment = body.resource
      const amount = payment.amount.value
      const paymentId = payment.id
      const customData = payment.custom_id // This should contain the user ID

      if (!customData) {
        console.error('No user ID found in payment custom data')
        return new Response('Missing user ID', { status: 400 })
      }

      // Get tokens for this payment amount
      const tokensToAdd = TOKEN_PRICING_MAP[amount]
      if (!tokensToAdd) {
        console.error(`Unknown payment amount: ${amount}`)
        return new Response(`Unknown payment amount: ${amount}`, { status: 400 })
      }

      // Create Supabase admin client
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )

      // Add tokens to user's balance
      const { error: updateError } = await supabaseAdmin.rpc('add_user_tokens', {
        user_id: customData,
        tokens_to_add: tokensToAdd,
        payment_id: paymentId,
        payment_amount: parseFloat(amount)
      })

      if (updateError) {
        console.error('Error adding tokens:', updateError)
        return new Response(`Error adding tokens: ${updateError.message}`, { status: 500 })
      }

      console.log(`Successfully added ${tokensToAdd} tokens to user ${customData}`)
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(`Webhook error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders
    })
  }
})
