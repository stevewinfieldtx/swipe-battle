// Fix: Replaced invalid Deno types reference with a global `Deno` declaration to resolve TypeScript errors.
declare const Deno: any;

// Follow this guide to deploy: https://supabase.com/docs/guides/functions/deploy
//
// 1. Set secrets: 
//    `supabase secrets set STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>`
// 2. Deploy: `supabase functions deploy stripe-webhook --no-verify-jwt`

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Get environment variables
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

// Validate required environment variables
if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY is not set. Please set it using: supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key');
  throw new Error('STRIPE_SECRET_KEY is not set');
}

if (!webhookSecret) {
  console.error('STRIPE_WEBHOOK_SECRET is not set. Please set it using: supabase secrets set STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret');
  throw new Error('STRIPE_WEBHOOK_SECRET is not set');
}

const stripe = new Stripe(stripeSecretKey, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2022-11-15',
});

serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      webhookSecret!,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(err.message, { status: 400 });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const clientReferenceId = session.client_reference_id;

    if (!clientReferenceId) {
      console.error('No client_reference_id (Supabase user ID) found in session.');
      return new Response('Webhook Error: Missing user ID', { status: 400 });
    }

    try {
      // Create a Supabase admin client to update user metadata
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      // Update the user's metadata to grant premium access
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        clientReferenceId,
        { user_metadata: { is_premium: true } }
      );
      
      if (error) {
        throw error;
      }

      console.log(`Successfully granted premium access to user: ${clientReferenceId}`);
    } catch (err: any) {
      console.error('Error updating user metadata:', err);
      return new Response(`Webhook handler error: ${err.message}`, { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});