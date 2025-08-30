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
    // Import Runware SDK modules (matching your working script)
    const { Runware, IImageInference } = await import('https://esm.sh/@runware/sdk-js@latest')
    
    // Initialize Runware client
    const runware = new Runware({ apiKey: RUNWARE_API_KEY })
    
    // Connect to Runware (like your script)
    await runware.connect()
    console.log('Successfully connected to Runware')

    // Create payload using IImageInference (matching your script exactly)
    const payload = new IImageInference({
      model: RUNWARE_MODEL,
      positivePrompt: prompt,
      height: 768, // Portrait orientation for model photos
      width: 512,
      steps: 28, // Using your script's step count
      scheduler: "DPMSolverSinglestepScheduler", // Default from your script
      numberResults: 1,
    })

    console.log(`Calling imageInference with model: ${RUNWARE_MODEL}`)
    
    // Call imageInference exactly like your script
    const results = await runware.imageInference({ requestImage: payload })
    
    console.log('Runware API response received:', results ? 'success' : 'null')

    // Handle response exactly like your script
    if (results && results[0] && 
        hasattr(results[0], "imageURL") && 
        results[0].imageURL) {
      
      const imageUrl = results[0].imageURL
      console.log(`Image generated successfully: ${imageUrl.substring(0, 60)}...`)
      
      return {
        success: true,
        imageUrl: imageUrl
      }
    } else {
      let errorDetail = "Malformed response or no imageURL."
      if (results && results[0]) {
        if (results[0].error) {
          errorDetail = `API Error: ${results[0].error}`
        } else if (results[0].message) {
          errorDetail = `API Message: ${results[0].message}`
        }
      } else if (!results) {
        errorDetail = "API returned no results."
      }
      
      return {
        success: false,
        error: errorDetail
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

// Helper function to check if object has property (like Python's hasattr)
function hasattr(obj: any, prop: string): boolean {
  return obj && typeof obj === 'object' && prop in obj
}
