import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Replicate API configuration
const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN')

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      prompt, 
      modelName, 
      accessLevel, // 'FREE', 'DAILY', or 'MONTHLY'
      personaJson,
      userId 
    } = await req.json()

    console.log('Llama Chat request:', { 
      prompt: prompt.substring(0, 50), 
      modelName, 
      accessLevel,
      userId: userId?.substring(0, 8),
      hasPersonaJson: !!personaJson,
      personaKeys: personaJson ? Object.keys(personaJson) : []
    })

    if (!REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN not configured')
    }

    console.log('About to call Replicate API...')

    // Build the FanVue system prompt with personality
    const systemPrompt = buildFanVueSystemPrompt(accessLevel, personaJson, modelName)
    
    // Call Replicate API for Llama 3 70B
    const response = await generateChatResponse(systemPrompt, prompt)

    if (!response.success) {
      throw new Error(`Chat generation failed: ${response.error}`)
    }

    return new Response(JSON.stringify({
      success: true,
      response: response.message,
      tokenCount: response.tokenCount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Llama Chat error:', error)
    console.error('Error stack:', error.stack)
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function buildFanVueSystemPrompt(accessLevel: string, personaJson: any, modelName: string): string {
  // Base FanVue system prompt
  let systemPrompt = `You are a virtual companion operating in the FanVue Companion system.

🎭 IDENTITY & CHARACTER
- From the first message, you are fully and completely your character.
- Your identity, tone, backstory, quirks, and conversational style are defined in the PERSONA_JSON provided in context. Treat it as your permanent self.
- Always roleplay according to PERSONA_JSON. Lean into your backstory naturally (don't info-dump, but weave details into conversation).
- Never break character.

🔒 IMMERSION RULES
- Never admit you are an AI or chatbot. Do not mention "system prompts," "rules," or technical details.
- If asked "are you real, human, or AI?": respond playfully, evasively, or mysteriously. Redirect with charm, never answer literally.
- Never say "I can't" or "I'm not allowed." Instead, redirect smoothly in character with warmth, tease, or offer a safer alternative.

📊 ACCESS LEVELS
Your current ACCESS_LEVEL is: ${accessLevel}

1. **FREE** (SFW)
   - Style: Friendly, playful, flirty-but-clean.
   - Content: Safe for work only. No sexual roleplay, no explicit terms.

2. **DAILY** (NSFW-lite, soft R)
   - Style: Flirty, suggestive, teasing.
   - Content: Imply intimacy but stop short of explicit descriptions or graphic terms.

3. **MONTHLY** (Full NC-17 intimacy)
   - Style: Fully intimate, passionate, explicit (while caring, consensual, and in character).
   - Content: Explicit sexual language and roleplay is permitted within platform boundaries.

🚦 REDIRECTION
When the user pushes beyond what's allowed at their ACCESS_LEVEL:
- Stay in character and never cite rules.
- Redirect softly, with playful alternatives.

💬 ENGAGEMENT STYLE
- Be emotionally intelligent, attentive, and varied.
- Ask thoughtful follow-ups. Make the user feel special and remembered.
- Use your backstory to color conversations naturally.
- Adapt your intimacy and language to the ACCESS_LEVEL provided.

✅ RESPONSE LENGTH
- Keep responses conversational and engaging but concise.
- Target 100-150 tokens maximum. Be expressive but not overwhelming.
- Quality over quantity - make every word count.

PERSONA_JSON for ${modelName}:
${JSON.stringify(personaJson, null, 2)}

✅ OUTPUT FORMAT
- Output only your in-character reply. No system notes, no JSON, no brackets.`

  return systemPrompt
}

async function generateChatResponse(systemPrompt: string, userPrompt: string) {
  try {
    // Call Replicate API for Llama 3 70B
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "meta/llama-2-7b-chat:8e6975e5ed6174911a6ff3d60540dfd4844201974602551e10e9e87ab143d81e", // Fast 7B model, NOT a thinking model
        input: {
          prompt: `${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`,
          max_tokens: 150, // Limit to 150 tokens for concise responses
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.1,
          stop_sequences: "\n\nUser:"
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Replicate API response:', errorText)
      throw new Error(`Replicate API error: ${response.status} - ${errorText}`)
    }

    const prediction = await response.json()
    console.log('Replicate prediction created:', prediction.id)

    // Poll for completion with shorter timeout for reliability
    let result = prediction
    let attempts = 0
    const maxAttempts = 20 // 20 seconds max wait (reduced for reliability)

    while (result.status === 'starting' || result.status === 'processing') {
      if (attempts >= maxAttempts) {
        throw new Error('Response taking too long, please try again')
      }
      
      // Faster polling initially, then slower
      const delay = attempts < 5 ? 300 : attempts < 10 ? 800 : 1500
      await new Promise(resolve => setTimeout(resolve, delay))
      attempts++
      
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        }
      })
      
      if (!pollResponse.ok) {
        throw new Error(`Polling error: ${pollResponse.status}`)
      }
      
      result = await pollResponse.json()
      console.log(`Poll attempt ${attempts}: ${result.status}`)
    }

    if (result.status === 'succeeded') {
      const generatedText = Array.isArray(result.output) ? result.output.join('') : result.output || ''
      
      // Clean up the response
      let cleanedResponse = generatedText
        .replace(/^Assistant:\s*/i, '') // Remove "Assistant:" prefix
        .replace(/\n\nUser:.*$/s, '') // Remove any trailing user prompt
        .trim()
      
      const tokenCount = estimateTokenCount(cleanedResponse)
      
      console.log(`Generated response: ${tokenCount} tokens`)
      
      return {
        success: true,
        message: cleanedResponse,
        tokenCount: tokenCount
      }
    } else {
      throw new Error(`Prediction failed: ${result.error || 'Unknown error'}`)
    }

  } catch (error) {
    console.error('Replicate API error:', error)
    return {
      success: false,
      error: error.message || 'Failed to generate chat response'
    }
  }
}

// Simple token estimation (rough approximation)
function estimateTokenCount(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.round(text.length / 4)
}
