export default async function handler(req, res) {
  console.log('=== CHAT API CALLED ===');
  console.log('Method:', req.method);
  
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

  // Simple test response first
  return res.status(200).json({
    success: true,
    response: "Hey there! I'm working now! This is a test response from the Vercel serverless function.",
    tokenCount: 20
  });
}
