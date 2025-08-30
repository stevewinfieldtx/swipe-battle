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
      userId 
    } = await req.json()

    console.log('Image generation request:', { prompt, photoType, modelName, userEmail })

    if (!RUNWARE_API_KEY) {
      throw new Error('RUNWARE_API_KEY not configured')
    }

    // Enhanced prompt based on photo type and model
    const enhancedPrompt = buildEnhancedPrompt(prompt, photoType, modelName)

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

function buildEnhancedPrompt(userPrompt: string, photoType: string, modelName: string): string {
  // Base prompt enhancement
  let enhanced = `Beautiful woman named ${modelName}, ${userPrompt}`

  // Add photo type specific styling
  switch (photoType) {
    case 'sfw':
      enhanced += ', appropriate clothing, elegant pose, professional photography, high quality, detailed'
      break
    case 'bikini':
      enhanced += ', wearing a bikini, beach setting or pool, summer vibes, professional photography, high quality'
      break
    case 'lingerie':
      enhanced += ', wearing elegant lingerie, bedroom setting, soft lighting, artistic pose, professional photography'
      break
    case 'topless':
      enhanced += ', artistic topless pose, tasteful composition, professional artistic photography, soft lighting'
      break
    case 'nude':
      enhanced += ', artistic nude pose, tasteful and elegant, professional art photography, beautiful lighting'
      break
    default:
      enhanced += ', professional photography, high quality, detailed'
  }

  // Add quality and style modifiers
  enhanced += ', 8k resolution, sharp focus, realistic, photorealistic'

  return enhanced
}

async function generateImageWithRunware(prompt: string, photoType: string) {
  try {
    // Import Runware SDK (using dynamic import for Deno Edge Functions)
    const { Runware } = await import('https://esm.sh/@runware/sdk-js@latest')
    
    // Initialize Runware SDK
    const runware = new Runware({ apiKey: RUNWARE_API_KEY })

    // Generate image using official SDK
    const images = await runware.requestImages({
      positivePrompt: prompt,
      model: RUNWARE_MODEL,
      width: 512,
      height: 768, // Portrait orientation for model photos
      numberResults: 1,
      steps: 50,
      CFGScale: 7.5,
      seed: Math.floor(Math.random() * 1000000), // Random seed for variety
      // Add safety filter for SFW content
      ...(photoType === 'sfw' && { safetyChecker: true })
    })

    if (images && images.length > 0 && images[0].imageURL) {
      return {
        success: true,
        imageUrl: images[0].imageURL
      }
    } else {
      return {
        success: false,
        error: 'No image generated or invalid response from Runware'
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
