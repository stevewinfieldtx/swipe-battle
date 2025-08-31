import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, modelName } = await req.json()
    
    console.log('AI Chat request:', { message: message?.substring(0, 50), modelName })
    
    // Get OpenRouter API key from environment
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY')
    
    if (!openRouterApiKey) {
      throw new Error('OpenRouter API key not configured')
    }

    // Call OpenRouter API
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://swipe-battle.vercel.app',
        'X-Title': 'Swipe Battle Chat'
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content: `You are ${modelName}, a friendly virtual companion. Keep responses under 150 tokens. Be engaging and conversational while staying in character.`
          },
          {
            role: "user", 
            content: message
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    })

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text()
      console.error('OpenRouter API error:', {
        status: openRouterResponse.status,
        statusText: openRouterResponse.statusText,
        body: errorText
      })
      throw new Error(`OpenRouter failed: ${openRouterResponse.status}`)
    }

    const result = await openRouterResponse.json()
    console.log('OpenRouter success')
    
    // Extract response
    let aiResponse
    if (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
      aiResponse = result.choices[0].message.content.trim()
    } else {
      console.error('Unexpected OpenRouter response format:', result)
      throw new Error('Invalid response format from OpenRouter')
    }

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('AI Chat error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})