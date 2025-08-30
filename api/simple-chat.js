export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, modelName } = req.body;
    console.log('Simple chat request:', { message: message?.substring(0, 50), modelName });
    console.log('OpenRouter API Key available:', !!process.env.OPENROUTER_API_KEY);

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key not configured in Vercel');
    }

    // Call OpenRouter for real AI responses
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://model-wars.com',
        'X-Title': 'Model Wars Chat'
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are ${modelName}, a friendly virtual companion. Keep responses under 150 tokens. Be flirty and engaging.`
          },
          {
            role: "user", 
            content: message
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error response:', errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('OpenRouter response:', JSON.stringify(result, null, 2));
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error('Invalid response format from OpenRouter');
    }
    
    const aiResponse = result.choices[0].message.content.trim();

    return res.status(200).json({
      success: true,
      response: aiResponse
    });

  } catch (error) {
    console.error('Simple chat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
