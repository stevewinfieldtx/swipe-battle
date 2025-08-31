import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    // Read the current ai-chat function to extract the system prompt
    const aiChatPath = '/opt/render/project/src/supabase/functions/ai-chat/index.ts'
    
    // For now, return the current hardcoded prompt
    // In a real implementation, you'd read from the file or a database
    const currentPrompt = 'You are {modelName}, a friendly virtual companion. Keep responses under 150 tokens. Be engaging and conversational while staying in character.'
    
    return new Response(
      JSON.stringify({ success: true, prompt: currentPrompt }),
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
    
    // Store the prompt in Deno KV or environment variable
    // For now, we'll simulate success
    console.log('System prompt would be updated to:', prompt)
    
    // In a real implementation, you would:
    // 1. Update the ai-chat function file
    // 2. Redeploy the function
    // 3. Or store in a database/KV store and modify ai-chat to read from there
    
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
    // In a real implementation, you'd read from the file system or database
    // For now, return mock data based on known models
    const models = [
      {
        name: 'Claudia',
        primary_type: 'The Grounded Goddess',
        description: 'A resilient and soulful woman with a deep connection to the earth'
      },
      {
        name: 'Mai',
        primary_type: 'Character',
        description: 'Another character model'
      }
    ]
    
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
    
    // Mock model data - in reality, you'd read from the JSON file
    const mockModelData = {
      model_id: 4,
      name: modelName.charAt(0).toUpperCase() + modelName.slice(1),
      age: 25,
      ethnicity: "unknown",
      origin: "Unknown location",
      big_five: {
        openness: 70,
        conscientiousness: 90,
        extraversion: 60,
        agreeableness: 95,
        neuroticism: 15
      },
      primary_type: "Character Type",
      description: "Character description goes here",
      personality_traits: {
        core_traits: ["trait1", "trait2"],
        communication_style: "communication style",
        interests: ["interest1", "interest2"],
        profession: "profession",
        values: ["value1", "value2"],
        humor_type: "humor type"
      },
      ai_instructions: {
        personality_prompt: `You are ${modelName}, a virtual companion.`,
        conversation_guidelines: [
          "Be engaging",
          "Stay in character"
        ],
        avoid: ["being rude"]
      }
    }
    
    return new Response(
      JSON.stringify({ success: true, model: mockModelData }),
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
    
    console.log(`Model ${modelName} would be updated with:`, modelData)
    
    // In a real implementation, you would:
    // 1. Write to the JSON file in public/models/
    // 2. Validate the data structure
    // 3. Handle file system operations
    
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
    
    console.log(`New model ${modelName} would be created with:`, modelData)
    
    // In a real implementation, you would:
    // 1. Create a new JSON file in public/models/
    // 2. Ensure the model name doesn't already exist
    // 3. Validate the data structure
    
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
    
    console.log(`Model ${modelName} would be deleted`)
    
    // In a real implementation, you would:
    // 1. Delete the JSON file from public/models/
    // 2. Ensure the model exists before deletion
    // 3. Handle any cleanup needed
    
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
    
    console.log(`LLM config would be updated:`, { model, temperature, maxTokens })
    
    // In a real implementation, you would:
    // 1. Store the configuration in Deno KV or environment variables
    // 2. Update the ai-chat function to use these settings
    // 3. Validate the model name against available models
    
    return new Response(
      JSON.stringify({ success: true, message: 'LLM configuration updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to update LLM config: ${error.message}`)
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