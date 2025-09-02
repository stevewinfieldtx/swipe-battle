import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Runware API configuration
const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY')
const RUNWARE_MODEL = 'runware:101@1'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      prompt, 
      photoType, 
      modelName, 
      userEmail, 
      userId,
      chatContext 
    } = await req.json()

    console.log('Image generation request:', { prompt, photoType, modelName, userEmail })

    if (!RUNWARE_API_KEY) {
      throw new Error('RUNWARE_API_KEY not configured')
    }

    // Enhanced prompt based on photo type, model, and chat context
    const enhancedPrompt = await buildEnhancedPrompt(prompt, photoType, modelName, chatContext)

    // Call Runware API using their SDK pattern
    const imageResponse = await generateImageWithRunware(enhancedPrompt, photoType)

    if (!imageResponse.success) {
      throw new Error(`Image generation failed: ${imageResponse.error}`)
    }

    // Store the request in Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Update the custom photo request with the generated image
    const { error: updateError } = await supabaseAdmin
      .from('custom_photo_requests')
      .insert({
        user_id: userId,
        model_name: modelName,
        user_email: userEmail,
        photo_type: photoType,
        prompt: prompt,
        enhanced_prompt: enhancedPrompt,
        image_url: imageResponse.imageUrl,
        status: 'completed',
        created_at: new Date().toISOString()
      })

    if (updateError) {
      console.error('Error storing request:', updateError)
    }

    return new Response(JSON.stringify({
      success: true,
      imageUrl: imageResponse.imageUrl,
      prompt: enhancedPrompt
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Image generation error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function buildEnhancedPrompt(userPrompt: string, photoType: string, modelName: string, chatContext?: string): Promise<string> {
  // Try to load model's physical description from their JSON file
  let physicalDescription = '';
  try {
    // Fetch model data from the public folder (this will work when deployed)
    const modelUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/model-configs/${modelName.toLowerCase()}.json`;
    const response = await fetch(modelUrl);
    
    if (response.ok) {
      const modelData = await response.json();
      physicalDescription = modelData.physical_description || '';
    }
  } catch (error) {
    console.log(`Could not load model config for ${modelName}, using fallback`);
  }
  
  // Start with physical description or fallback to name
  let enhanced = physicalDescription 
    ? `${physicalDescription}, ${userPrompt}, ` 
    : `Stunning portrait of a beautiful woman named ${modelName}, ${userPrompt}, `;
  
  // Add chat context if provided (clothing and activity from conversation)
  if (chatContext && chatContext !== 'No specific clothing or activity mentioned in recent chat') {
    enhanced += `${chatContext}, `
  }

  // Add detailed photo type specific styling and composition
  switch (photoType) {
    case 'sfw':
      enhanced += `wearing tasteful and elegant clothing that flatters her figure, sophisticated and classy outfit, perfect posture with confident and graceful pose, natural and genuine expression, warm and inviting smile, professional fashion photography style, elegant composition with perfect framing, soft natural lighting that enhances her features, beautiful background that complements the overall aesthetic, appropriate and stylish setting, high-end fashion photography quality, detailed facial features with expressive eyes, flawless skin texture, perfect hair styling, sophisticated makeup that enhances natural beauty, professional modeling pose, elegant and refined atmosphere`
      break
    case 'bikini':
      enhanced += `wearing a stylish and flattering bikini that suits her body type perfectly, tropical beach setting with crystal clear blue water and pristine white sand, or luxurious pool area with elegant resort ambiance, summer vacation vibes with warm golden sunlight, relaxed and confident beach pose showing her natural beauty, genuine carefree smile, professional swimwear photography style, perfect composition with stunning beach or pool backdrop, natural outdoor lighting with golden hour glow, beautiful ocean waves or sparkling pool water, palm trees or elegant poolside furniture, high-quality swimwear photography, detailed skin texture with healthy sun-kissed glow, flowing hair moved by gentle ocean breeze, beach or poolside accessories, vibrant summer colors, tropical paradise atmosphere`
      break
    case 'lingerie':
      enhanced += `wearing exquisite and elegant lingerie that perfectly accentuates her feminine curves, luxurious bedroom setting with sophisticated interior design, soft romantic lighting creating intimate and artistic atmosphere, sensual and artistic pose that emphasizes her natural beauty and confidence, gentle and alluring expression, professional boudoir photography style, perfect composition with elegant bedroom backdrop, warm ambient lighting with soft shadows, beautiful silk sheets or elegant furniture, sophisticated color palette, high-end intimate photography quality, detailed skin texture with natural glow, perfect hair styling, subtle and elegant makeup, delicate jewelry or accessories, romantic and intimate ambiance, artistic and tasteful composition, luxurious and sophisticated setting`
      break
    case 'topless':
      enhanced += `artistic topless portrait emphasizing natural feminine beauty, tasteful and sophisticated composition that celebrates the human form, confident and empowered pose showing strength and elegance, serene and contemplative expression, professional artistic nude photography style, perfect lighting that sculpts her form beautifully, artistic studio setting or natural outdoor location, soft directional lighting creating beautiful highlights and shadows, elegant and refined atmosphere, high-end art photography quality, detailed skin texture with natural luminosity, flowing hair, minimalist and sophisticated background, artistic composition focusing on form and beauty, tasteful and respectful presentation, gallery-worthy artistic photography, sophisticated and elegant mood, professional artistic direction`
      break
    case 'nude':
      enhanced += `artistic nude portrait celebrating natural feminine beauty and form, tasteful and sophisticated artistic composition, confident and empowered pose emphasizing grace and elegance, serene and contemplative expression showing inner strength, professional fine art nude photography style, perfect studio lighting that sculpts her form with beautiful highlights and shadows, elegant artistic setting with minimalist sophisticated background, soft directional lighting creating dramatic and beautiful contrast, artistic and refined atmosphere, gallery-quality fine art photography, detailed skin texture with natural luminous glow, flowing hair styling, sophisticated artistic composition, tasteful and respectful presentation of the human form, museum-worthy artistic photography, sophisticated and elegant artistic mood, professional artistic direction, timeless and classic aesthetic`
      break
    default:
      enhanced += `professional portrait photography with elegant composition, sophisticated lighting, and refined artistic direction, high-quality detailed imagery`
  }

  // Add comprehensive technical and quality specifications
  enhanced += `, captured with professional photography equipment, 8K ultra-high resolution, crystal clear sharp focus, photorealistic rendering with exceptional detail, perfect exposure and color grading, professional retouching, magazine-quality finish, award-winning photography composition, masterpiece quality, hyperrealistic detail, perfect skin texture and natural beauty`

  return enhanced
}

async function generateImageWithRunware(prompt: string, photoType: string) {
  try {
    // Import Runware SDK modules
    const { Runware } = await import('https://esm.sh/@runware/sdk-js@latest')
    
    // Initialize Runware client
    const runware = new Runware({ apiKey: RUNWARE_API_KEY })
    
    // Connect to Runware
    await runware.connect()
    console.log('Successfully connected to Runware')

    // Create payload as a plain object (not using constructor)
    const payload = {
      model: RUNWARE_MODEL,
      positivePrompt: prompt,
      height: 768, // Portrait orientation for model photos
      width: 512,
      steps: 28,
      scheduler: "DPMSolverSinglestepScheduler",
      numberResults: 1,
    }

    console.log(`Calling requestImages with model: ${RUNWARE_MODEL}`)
    
    // Call requestImages with the payload (correct Runware SDK method)
    const results = await runware.requestImages(payload)
    
    console.log('Runware API response received:', results ? 'success' : 'null')

    // Handle response from Runware API
    if (results && Array.isArray(results) && results.length > 0) {
      const result = results[0]
      
      // Check for imageURL in the response
      if (result && result.imageURL) {
        const imageUrl = result.imageURL
        console.log(`Image generated successfully: ${imageUrl.substring(0, 60)}...`)
        
        return {
          success: true,
          imageUrl: imageUrl
        }
      } else if (result && result.error) {
        return {
          success: false,
          error: `API Error: ${result.error}`
        }
      } else {
        return {
          success: false,
          error: "No imageURL in response"
        }
      }
    } else {
      return {
        success: false,
        error: "API returned no results or empty array"
      }
    }

  } catch (error) {
    console.error('Runware SDK error:', error)
    return {
      success: false,
      error: error.message || 'Failed to generate image with Runware SDK'
    }
  }
}


