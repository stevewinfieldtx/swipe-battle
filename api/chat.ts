import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, modelName } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Build the conversation context
    const conversationHistory = messages
      .map((msg: any) => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    // Create a persona for the AI model based on the model name
    const systemPrompt = `You are ${modelName}, a charming and engaging AI model. You are friendly, flirty, and personable. Keep your responses conversational and engaging, as if you're having a genuine conversation with someone you're interested in getting to know better. Be playful but respectful. Keep responses to 2-3 sentences typically.`;

    const prompt = `${systemPrompt}\n\nConversation:\n${conversationHistory}\nAssistant:`;

    // Call Replicate API with Llama 3 70B
    const output = await replicate.run(
      "meta/meta-llama-3-70b-instruct",
      {
        input: {
          prompt: prompt,
          max_tokens: 200,
          temperature: 0.7,
          top_p: 0.9,
          system_prompt: systemPrompt
        }
      }
    );

    // The output is typically an array of text chunks, join them
    const responseText = Array.isArray(output) ? output.join('') : output;

    return res.status(200).json({ 
      message: responseText.trim(),
      model: 'meta-llama-3-70b-instruct'
    });

  } catch (error: any) {
    console.error('Replicate API error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate response',
      details: error.message 
    });
  }
}
