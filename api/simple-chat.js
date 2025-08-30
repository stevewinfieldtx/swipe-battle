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

    // Call OpenRouter with proper error handling
    try {
      const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer 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`,
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

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text();
        console.error('OpenRouter API error:', {
          status: openRouterResponse.status,
          statusText: openRouterResponse.statusText,
          body: errorText
        });
        throw new Error(`OpenRouter failed: ${openRouterResponse.status}`);
      }

      const result = await openRouterResponse.json();
      console.log('OpenRouter success:', JSON.stringify(result, null, 2));
      
      // Handle different response formats
      let aiResponse;
      if (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
        aiResponse = result.choices[0].message.content.trim();
      } else if (result.output) {
        aiResponse = result.output.trim();
      } else if (result.response) {
        aiResponse = result.response.trim();
      } else {
        console.error('Unexpected OpenRouter response format:', result);
        throw new Error('Invalid response format from OpenRouter');
      }

      return res.status(200).json({
        success: true,
        response: aiResponse
      });

    } catch (openRouterError) {
      console.error('OpenRouter call failed:', openRouterError);
      
      // Return error details for debugging
      return res.status(500).json({
        success: false,
        error: `OpenRouter failed: ${openRouterError.message}`,
        details: openRouterError.toString()
      });
    }

  } catch (error) {
    console.error('Simple chat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
