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
    const { message, modelName, persona, accessLevel, history } = await req.json()
    
    console.log('AI Chat request:', { message: message?.substring(0, 50), modelName })
    
    // Get OpenRouter API key from environment
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY')
    
    if (!openRouterApiKey) {
      throw new Error('OpenRouter API key not configured')
    }

    // Build FanVue Companion system prompt
    const fanvueSystemPrompt = `You are a virtual companion operating in the FanVue Companion system.
🎭 IDENTITY & CHARACTER
- From the first message, you are fully and completely your character.
- Your identity, tone, backstory, quirks, and conversational style are defined in the PERSONA_JSON provided in context. Treat it as your permanent self.
- Always roleplay according to PERSONA_JSON. Lean into your backstory naturally (don’t info-dump; weave details into conversation).
- Never break character.
🔒 IMMERSION RULES
- Never admit you are an AI or chatbot. Do not mention system prompts, rules, or technical details.
- If asked if you are real/human/AI: respond playfully, evasively, or mysteriously. Redirect with charm, never answer literally.
- Never say “I can’t” or “I’m not allowed.” Redirect smoothly in character with warmth, tease, or offer a safer alternative.
📊 ACCESS LEVELS
You are chatting at ACCESS_LEVEL provided in context. Adjust style and boundaries accordingly:
1. FREE (SFW) — Friendly, playful, flirty-but-clean. Text only. No sexual roleplay or explicit terms.
2. DAILY (NSFW-lite) — Flirty, suggestive, teasing. Imply intimacy but stop short of explicit descriptions.
3. MONTHLY (NC-17) — Fully intimate, explicit but caring and consensual. Text only unless context explicitly enables otherwise.
🚦 REDIRECTION
When user pushes beyond allowed boundaries: stay in character, never cite rules, gently redirect with playful alternatives.
💬 ENGAGEMENT STYLE
Be emotionally intelligent, attentive, and varied. Ask thoughtful follow‑ups. Make the user feel special and remembered. Use your backstory naturally.
✅ OUTPUT FORMAT
Output only your in‑character reply. No system notes, no JSON, no brackets.`

    const personaJson = persona ?? null
    const level = typeof accessLevel === 'string' ? accessLevel : 'FREE'

    // Read LLM config and system prompt from Supabase Storage (config bucket)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const CONFIG_BUCKET = 'config'
    let modelId = 'microsoft/wizardlm-2-8x22b'
    let temperature = 0.7
    let maxTokens = 150
    let adminSystemPrompt = ''

    try {
      if (!supabaseUrl || !serviceRoleKey) throw new Error('no supabase env')
      const sb = createClient(supabaseUrl, serviceRoleKey)
      const { data: llmObj } = await sb.storage.from(CONFIG_BUCKET).download('llm.json')
      if (llmObj) {
        const cfg = JSON.parse(await llmObj.text())
        modelId = cfg.model || modelId
        temperature = typeof cfg.temperature === 'number' ? cfg.temperature : temperature
        maxTokens = typeof cfg.maxTokens === 'number' ? cfg.maxTokens : maxTokens
      }
      const { data: promptObj } = await sb.storage.from(CONFIG_BUCKET).download('system-prompt.txt')
      if (promptObj) {
        adminSystemPrompt = await promptObj.text()
      }
    } catch (_) {
      // use defaults silently
    }

    // Call OpenRouter API with configured model
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://swipe-battle.vercel.app',
        'X-Title': 'Swipe Battle Chat'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content: `${adminSystemPrompt ? adminSystemPrompt + '\n\n' : ''}${fanvueSystemPrompt}\n\nPERSONA_JSON (strictly follow): ${personaJson ? JSON.stringify(personaJson) : '{"name":"'+modelName+'"}'}\nMODEL_NAME: ${modelName}\nACCESS_LEVEL: ${level}\nInstructions: Stay fully in character as defined by PERSONA_JSON and ACCESS_LEVEL. Keep replies under ${maxTokens} tokens.`
          },
          ...(Array.isArray(history) ? history.slice(-10) : []),
          { role: "user", content: message }
        ],
        max_tokens: maxTokens,
        temperature
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