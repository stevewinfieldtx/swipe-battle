import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('=== CHAT API CALLED ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, modelName, accessLevel, personaJson } = req.body;
    console.log('Request data:', { prompt: prompt?.substring(0, 50), modelName, accessLevel });
    
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not found in environment');
      throw new Error('API key not configured');
    }

    // Build system prompt
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
- Output only your in-character reply. No system notes, no JSON, no brackets.`;

    // Add personality context
    if (personaJson) {
      systemPrompt += `\n\nPERSONA_JSON for ${modelName}:\n${JSON.stringify(personaJson, null, 2)}`;
    }

    // Add access level context
    systemPrompt += `\n\nCurrent ACCESS_LEVEL: ${accessLevel}`;

    // Call OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://model-wars.com',
        'X-Title': 'FanVue Companion Chat'
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
        top_p: 0.9,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.choices || result.choices.length === 0) {
      throw new Error('No response generated');
    }

    res.status(200).json({
      success: true,
      response: result.choices[0].message.content.trim(),
      tokenCount: result.usage?.total_tokens || 0
    });

  } catch (error: any) {
    console.error('Chat API error:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      error: error.message || 'Chat generation failed',
      details: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}
