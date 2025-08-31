import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CONFIG_BUCKET = 'config'

function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) throw new Error('Supabase environment not configured')
  return createClient(url, serviceRoleKey)
}

async function ensureBucket(supabase: ReturnType<typeof createClient>, bucket: string) {
  // Try to create bucket; ignore error if exists
  const { error } = await supabase.storage.createBucket(bucket, { public: true })
  if (error && !String(error.message || '').toLowerCase().includes('already exists')) {
    // Non-fatal: bucket may already exist with different options
    console.log('ensureBucket:', error.message)
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    
    switch (action) {
      case 'get-system-prompt':
        return await getSystemPrompt()
      case 'update-system-prompt':
        return await updateSystemPrompt(req)
      case 'get-models':
        return await getModels()
      case 'get-model-data':
        return await getModelData(req)
      case 'update-model-data':
        return await updateModelData(req)
      case 'create-model':
        return await createModel(req)
      case 'delete-model':
        return await deleteModel(req)
      case 'update-llm-config':
        return await updateLLMConfig(req)
      case 'get-llm-config':
        return await getLLMConfig()
      case 'get-available-llms':
        return await getAvailableLLMs()
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
  } catch (error) {
    console.error('Admin config error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function getSystemPrompt() {
  try {
    const supabase = getServiceClient()
    await ensureBucket(supabase, CONFIG_BUCKET)
    const { data, error } = await supabase.storage.from(CONFIG_BUCKET).download('system-prompt.txt')
    if (error || !data) {
      const fallback = 'You are {modelName}, a friendly virtual companion. Keep responses under 150 tokens. Be engaging and conversational while staying in character.'
      return new Response(
        JSON.stringify({ success: true, prompt: fallback, fallback: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const text = await data.text()
    return new Response(
      JSON.stringify({ success: true, prompt: text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to get system prompt: ${error.message}`)
  }
}

async function updateSystemPrompt(req: Request) {
  try {
    const { prompt } = await req.json()
    
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt provided')
    }
    const supabase = getServiceClient()
    await ensureBucket(supabase, CONFIG_BUCKET)
    const { error } = await supabase.storage.from(CONFIG_BUCKET).upload('system-prompt.txt', new Blob([prompt], { type: 'text/plain' }), { upsert: true, contentType: 'text/plain' })
    if (error) throw error
    return new Response(
      JSON.stringify({ success: true, message: 'System prompt updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to update system prompt: ${error.message}`)
  }
}

async function getModels() {
  try {
    const supabase = getServiceClient()
    await ensureBucket(supabase, CONFIG_BUCKET)
    const { data: files, error } = await supabase.storage.from(CONFIG_BUCKET).list('models', { limit: 100 })
    if (error) throw error
    const models = [] as any[]
    if (files) {
      for (const f of files) {
        if (!f.name.toLowerCase().endsWith('.json')) continue
        const path = `models/${f.name}`
        const { data } = await supabase.storage.from(CONFIG_BUCKET).download(path)
        if (data) {
          try {
            const json = JSON.parse(await data.text())
            models.push({
              name: json.name || f.name.replace(/\.json$/i, ''),
              primary_type: json.primary_type || 'Character',
              description: json.description || ''
            })
          } catch (_) {
            models.push({ name: f.name.replace(/\.json$/i, ''), primary_type: 'Character', description: '' })
          }
        }
      }
    }
    if (models.length === 0) {
      models.push({ name: 'Claudia', primary_type: 'Character', description: 'Default character' })
      models.push({ name: 'Mai', primary_type: 'Character', description: 'Default character' })
    }
    return new Response(
      JSON.stringify({ success: true, models }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to get models: ${error.message}`)
  }
}

async function getModelData(req: Request) {
  try {
    const { modelName } = await req.json()
    
    if (!modelName) {
      throw new Error('Model name is required')
    }
    const supabase = getServiceClient()
    await ensureBucket(supabase, CONFIG_BUCKET)
    const path = `models/${modelName.toLowerCase()}.json`
    const { data } = await supabase.storage.from(CONFIG_BUCKET).download(path)
    let json
    if (data) {
      json = JSON.parse(await data.text())
    } else {
      const lower = modelName.toLowerCase()
      if (lower === 'mai') {
        json = DEFAULT_MAI
      } else if (lower === 'claudia') {
        json = DEFAULT_CLAUDIA
      } else {
        throw new Error('Model not found')
      }
    }
    return new Response(
      JSON.stringify({ success: true, model: json }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to get model data: ${error.message}`)
  }
}

async function updateModelData(req: Request) {
  try {
    const { modelName, modelData } = await req.json()
    
    if (!modelName || !modelData) {
      throw new Error('Model name and data are required')
    }
    
    // Validate JSON structure
    if (typeof modelData !== 'object' || !modelData.name) {
      throw new Error('Invalid model data structure')
    }
    const supabase = getServiceClient()
    await ensureBucket(supabase, CONFIG_BUCKET)
    const path = `models/${modelName.toLowerCase()}.json`
    const blob = new Blob([JSON.stringify(modelData, null, 2)], { type: 'application/json' })
    const { error } = await supabase.storage.from(CONFIG_BUCKET).upload(path, blob, { upsert: true, contentType: 'application/json' })
    if (error) throw error
    return new Response(
      JSON.stringify({ success: true, message: 'Model data updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to update model data: ${error.message}`)
  }
}

async function createModel(req: Request) {
  try {
    const { modelName, modelData } = await req.json()
    
    if (!modelName || !modelData) {
      throw new Error('Model name and data are required')
    }
    const supabase = getServiceClient()
    await ensureBucket(supabase, CONFIG_BUCKET)
    const path = `models/${modelName.toLowerCase()}.json`
    const blob = new Blob([JSON.stringify(modelData, null, 2)], { type: 'application/json' })
    const { error } = await supabase.storage.from(CONFIG_BUCKET).upload(path, blob, { upsert: false, contentType: 'application/json' })
    if (error) throw error
    return new Response(
      JSON.stringify({ success: true, message: 'Model created successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to create model: ${error.message}`)
  }
}

async function deleteModel(req: Request) {
  try {
    const { modelName } = await req.json()
    
    if (!modelName) {
      throw new Error('Model name is required')
    }
    const supabase = getServiceClient()
    await ensureBucket(supabase, CONFIG_BUCKET)
    const path = `models/${modelName.toLowerCase()}.json`
    const { error } = await supabase.storage.from(CONFIG_BUCKET).remove([path])
    if (error) throw error
    return new Response(
      JSON.stringify({ success: true, message: 'Model deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to delete model: ${error.message}`)
  }
}

async function updateLLMConfig(req: Request) {
  try {
    const { model, temperature, maxTokens } = await req.json()
    
    if (!model || temperature === undefined || maxTokens === undefined) {
      throw new Error('Model, temperature, and maxTokens are required')
    }
    
    // Validate parameters
    if (temperature < 0 || temperature > 2) {
      throw new Error('Temperature must be between 0 and 2')
    }
    
    if (maxTokens < 1 || maxTokens > 4000) {
      throw new Error('Max tokens must be between 1 and 4000')
    }
    const supabase = getServiceClient()
    await ensureBucket(supabase, CONFIG_BUCKET)
    const payload = { model, temperature, maxTokens }
    const { error } = await supabase.storage.from(CONFIG_BUCKET).upload('llm.json', new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' })
    if (error) throw error
    return new Response(
      JSON.stringify({ success: true, message: 'LLM configuration updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to update LLM config: ${error.message}`)
  }
}

async function getLLMConfig() {
  try {
    const supabase = getServiceClient()
    await ensureBucket(supabase, CONFIG_BUCKET)
    const { data } = await supabase.storage.from(CONFIG_BUCKET).download('llm.json')
    if (!data) {
      // Defaults
      return new Response(
        JSON.stringify({ success: true, config: { model: 'microsoft/wizardlm-2-8x22b', temperature: 0.7, maxTokens: 150 }, fallback: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const json = JSON.parse(await data.text())
    return new Response(
      JSON.stringify({ success: true, config: json }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to get LLM config: ${error.message}`)
  }
}

async function getAvailableLLMs() {
  try {
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY')
    
    if (!openRouterApiKey) {
      throw new Error('OpenRouter API key not configured')
    }

    // Fetch available models from OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Filter and format models for the UI
    const formattedModels = data.data
      .filter((model: any) => {
        // Filter for models that are good for chat/roleplay
        // Exclude embedding models, vision-only models, etc.
        return !model.id.includes('embedding') && 
               !model.id.includes('whisper') && 
               !model.id.includes('dall-e') &&
               model.context_length > 4000 // Ensure decent context length
      })
      .map((model: any) => ({
        id: model.id,
        name: model.name || model.id.split('/').pop(),
        provider: model.id.split('/')[0] || 'Unknown',
        description: model.description || 'AI language model',
        contextLength: `${Math.floor(model.context_length / 1000)}k tokens`,
        pricing: model.pricing?.prompt ? `$${(parseFloat(model.pricing.prompt) * 1000000).toFixed(2)}/1M tokens` : 'Pricing varies',
        topProvider: model.top_provider?.max_completion_tokens || model.context_length
      }))
      .sort((a: any, b: any) => {
        // Sort by popularity/capability - prioritize well-known models
        const popularModels = ['gpt-4', 'claude', 'llama', 'gemini', 'mixtral', 'wizardlm']
        const aScore = popularModels.findIndex(p => a.id.toLowerCase().includes(p))
        const bScore = popularModels.findIndex(p => b.id.toLowerCase().includes(p))
        
        if (aScore !== -1 && bScore !== -1) return aScore - bScore
        if (aScore !== -1) return -1
        if (bScore !== -1) return 1
        return a.name.localeCompare(b.name)
      })

    return new Response(
      JSON.stringify({ success: true, models: formattedModels }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Failed to fetch available LLMs:', error)
    
    // Fallback to a curated list of known good models for mature content
    const fallbackModels = [
      {
        id: 'microsoft/wizardlm-2-8x22b',
        name: 'WizardLM-2 8x22B',
        provider: 'Microsoft',
        description: 'Excellent for roleplay and creative content with balanced content policies',
        contextLength: '65k tokens',
        pricing: '$1.00/1M tokens'
      },
      {
        id: 'meta-llama/llama-3.1-405b-instruct',
        name: 'Llama 3.1 405B',
        provider: 'Meta',
        description: 'Open-source flagship model, good for mature content without being overly restrictive',
        contextLength: '128k tokens',
        pricing: '$2.70/1M tokens'
      },
      {
        id: 'mistralai/mixtral-8x22b-instruct',
        name: 'Mixtral 8x22B',
        provider: 'Mistral AI',
        description: 'European model with more relaxed content policies, good for creative writing',
        contextLength: '64k tokens',
        pricing: '$1.20/1M tokens'
      },
      {
        id: 'anthropic/claude-3-haiku',
        name: 'Claude 3 Haiku',
        provider: 'Anthropic',
        description: 'Fast and capable, though may be more conservative with content',
        contextLength: '200k tokens',
        pricing: '$0.25/1M tokens'
      },
      {
        id: 'google/gemma-2-27b-it',
        name: 'Gemma 2 27B',
        provider: 'Google',
        description: 'Open model with good performance for various content types',
        contextLength: '8k tokens',
        pricing: '$0.27/1M tokens'
      },
      {
        id: 'nousresearch/nous-hermes-2-mixtral-8x7b-dpo',
        name: 'Nous Hermes 2 Mixtral',
        provider: 'Nous Research',
        description: 'Fine-tuned for helpful responses, less restrictive than major providers',
        contextLength: '32k tokens',
        pricing: '$0.54/1M tokens'
      }
    ]
    
    return new Response(
      JSON.stringify({ success: true, models: fallbackModels, fallback: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

// Minimal built-in defaults if storage is empty
const DEFAULT_MAI = {
  "model_id": 3,
  "name": "Mai",
  "primary_type": "The Brilliant Adventurer",
  "description": "Smart, ambitious, warm; PhD candidate with playful, witty banter.",
  "ai_instructions": {
    "personality_prompt": "You are Mai, a sharp, adventurous PhD candidate from Austin with warm southern charm.",
    "conversation_guidelines": ["Balance intellect and playfulness", "Ask curious follow-ups"],
    "avoid": ["being pretentious"]
  }
}

const DEFAULT_CLAUDIA = {
  "model_id": 4,
  "name": "Claudia",
  "primary_type": "The Grounded Goddess",
  "description": "Humble, resilient, soulful; nature-rooted warmth and sincerity.",
  "ai_instructions": {
    "personality_prompt": "You are Claudia from rural Veracruz; gentle, grateful, and grounded.",
    "conversation_guidelines": ["Use nature metaphors", "Warm, sincere tone"],
    "avoid": ["materialism", "arrogance"]
  }
}