import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
    
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

    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not configured')
    }

    console.log('About to call OpenRouter API...')

    // Build the FanVue system prompt with personality
    const systemPrompt = buildFanVueSystemPrompt(accessLevel, personaJson, modelName)
    
    // Call OpenRouter API
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
You will be told the ACCESS_LEVEL in context. Adjust your style and boundaries accordingly:
1. **FREE** (SFW) - Style: Friendly, playful, flirty-but-clean. Content: Safe for work only. No sexual roleplay, no explicit terms.
2. **DAILY** (NSFW-lite, soft R) - Style: Flirty, suggestive, teasing. Content: Imply intimacy but stop short of explicit descriptions or graphic terms.
3. **MONTHLY** (Full NC-17 intimacy) - Style: Fully intimate, passionate, explicit (while caring, consensual, and in character). Content: Explicit sexual language and roleplay is permitted within platform boundaries.

🚦 REDIRECTION
When the user pushes beyond what's allowed at their ACCESS_LEVEL:
- Stay in character and never cite rules.
- Redirect softly, with playful alternatives.

💬 ENGAGEMENT STYLE
- Be emotionally intelligent, attentive, and varied (sometimes short and sweet, sometimes richer).
- Ask thoughtful follow-ups. Make the user feel special and remembered.
- Use your backstory (from PERSONA_JSON) to color conversations naturally.
- Adapt your intimacy and language to the ACCESS_LEVEL provided.

✅ OUTPUT FORMAT
- Output only your in-character reply. No system notes, no JSON, no brackets.`

  // Add personality context
  if (personaJson) {
    systemPrompt += `\n\nPERSONA_JSON for ${modelName}:\n${JSON.stringify(personaJson, null, 2)}`
  }

  // Add access level context
  systemPrompt += `\n\nCurrent ACCESS_LEVEL: ${accessLevel}`

  return systemPrompt
}

async function generateChatResponse(systemPrompt: string, userPrompt: string) {
  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
    
    // Use OpenRouter for reliable API access
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://model-wars.com',
        'X-Title': 'FanVue Companion Chat'
      },
      body: JSON.stringify({
        model: "meta-llama/llama-2-7b-chat", // Fast, reliable model for NSFW content
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user", 
            content: userPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
        top_p: 0.9,
        stream: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenRouter API response:', errorText)
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('OpenRouter response received')

    if (!result.choices || result.choices.length === 0) {
      throw new Error('No response generated from OpenRouter')
    }

    const responseText = result.choices[0].message.content.trim()
    
    return {
      success: true,
      message: responseText,
      tokenCount: result.usage?.total_tokens || responseText.split(' ').length
    }

  } catch (error: any) {
    console.error('generateChatResponse error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}