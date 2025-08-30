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

    // For now, return a simple AI-like response to test the endpoint
    const responses = [
      `Hey there! I'm ${modelName} and I love chatting with you! 💕`,
      `That's interesting! Tell me more about that 😊`,
      `You're so sweet! I really enjoy our conversations 💖`,
      `Mmm, I like where this is going... what else is on your mind? 😉`,
      `You always know what to say to make me smile! ✨`
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    return res.status(200).json({
      success: true,
      response: randomResponse
    });

  } catch (error) {
    console.error('Simple chat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
