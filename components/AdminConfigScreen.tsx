import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface AdminConfigScreenProps {
  onBack: () => void;
}

interface Model {
  name: string;
  primary_type: string;
  description: string;
}

interface ModelData {
  model_id: number;
  name: string;
  age: number;
  ethnicity: string;
  origin: string;
  big_five: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  primary_type: string;
  description: string;
  personality_traits: {
    core_traits: string[];
    communication_style: string;
    interests: string[];
    profession: string;
    values: string[];
    humor_type: string;
  };
  ai_instructions: {
    personality_prompt: string;
    conversation_guidelines: string[];
    avoid: string[];
  };
}

const AdminConfigScreen: React.FC<AdminConfigScreenProps> = ({ onBack }) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelData, setModelData] = useState<ModelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompt' | 'models' | 'llm'>('prompt');
  const [selectedLLM, setSelectedLLM] = useState('microsoft/wizardlm-2-8x22b');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(150);
  const [customLLM, setCustomLLM] = useState({ name: '', provider: '', id: '' });
  const [useCustomLLM, setUseCustomLLM] = useState(false);
  const [availableLLMs, setAvailableLLMs] = useState<any[]>([]);
  const [llmLoading, setLlmLoading] = useState(false);

  useEffect(() => {
    loadSystemPrompt();
    loadModels();
    loadAvailableLLMs();
    loadSavedLLMConfig();
  }, []);

  const loadAvailableLLMs = async () => {
    try {
      setLlmLoading(true);
      const url = new URL(window.location.origin);
      url.pathname = '/functions/v1/admin-config';
      url.searchParams.set('action', 'get-available-llms');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'apikey': `${supabase.supabaseKey}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (result.success) {
        setAvailableLLMs(result.models);
        if (result.fallback) {
          console.log('Using fallback LLM list - API fetch failed');
        }
      } else {
        console.error('Failed to load LLMs:', result.error);
      }
    } catch (error) {
      console.error('Error loading available LLMs:', error);
      // Set a minimal fallback list
      setAvailableLLMs([
        {
          id: 'microsoft/wizardlm-2-8x22b',
          name: 'WizardLM-2 8x22B',
          provider: 'Microsoft',
          description: 'Excellent for roleplay and creative content with balanced content policies',
          contextLength: '65k tokens',
          pricing: '$1.00/1M tokens'
        }
      ]);
    } finally {
      setLlmLoading(false);
    }
  };

  const loadSystemPrompt = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/admin-config?action=get-system-prompt`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data?.success) {
        setSystemPrompt(data.prompt);
      } else {
        throw new Error(data?.error || 'Failed to load system prompt');
      }
    } catch (error) {
      console.error('Error loading system prompt:', error);
      console.error('Failed to load system prompt');
    } finally {
      setLoading(false);
    }
  };

  const saveSystemPrompt = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/admin-config?action=update-system-prompt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: systemPrompt })
      });
      
      const data = await response.json();
      
      if (data?.success) {
        console.log('System prompt updated successfully');
      } else {
        throw new Error(data?.error || 'Failed to save system prompt');
      }
    } catch (error) {
      console.error('Error saving system prompt:', error);
      console.error('Failed to save system prompt');
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/admin-config?action=get-models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data?.success) {
        setModels(data.models || []);
      } else {
        throw new Error(data?.error || 'Failed to load models');
      }
    } catch (error) {
      console.error('Error loading models:', error);
      console.error('Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const loadModelData = async (modelName: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/admin-config?action=get-model-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ modelName })
      });
      
      const data = await response.json();
      
      if (data?.success) {
        setModelData(data.model);
        setSelectedModel(modelName);
      } else {
        throw new Error(data?.error || 'Failed to load model data');
      }
    } catch (error) {
      console.error('Error loading model data:', error);
      console.error('Failed to load model data');
    } finally {
      setLoading(false);
    }
  };

  const saveModelData = async () => {
    if (!selectedModel || !modelData) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/admin-config?action=update-model-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ modelName: selectedModel, modelData })
      });
      
      const data = await response.json();
      
      if (data?.success) {
        console.log('Model data updated successfully');
        loadModels();
      } else {
        throw new Error(data?.error || 'Failed to save model data');
      }
    } catch (error) {
      console.error('Error saving model data:', error);
      console.error('Failed to save model data');
    } finally {
      setLoading(false);
    }
  };

  const saveLLMConfiguration = async () => {
     try {
       setLoading(true);
       const response = await fetch(`${supabase.supabaseUrl}/functions/v1/admin-config?action=update-llm-config`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${supabase.supabaseKey}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({ 
           model: selectedLLM,
           temperature: temperature,
           maxTokens: maxTokens
         })
       });
       
       const data = await response.json();
       
       if (data?.success) {
         console.log('LLM configuration updated successfully');
       } else {
         throw new Error(data?.error || 'Failed to save LLM configuration');
       }
     } catch (error) {
       console.error('Error saving LLM configuration:', error);
       console.error('Failed to save LLM configuration');
     } finally {
       setLoading(false);
     }
   };

   const createNewModel = () => {
    const newModelData: ModelData = {
      model_id: Date.now(),
      name: 'New Model',
      age: 25,
      ethnicity: 'Unknown',
      origin: 'Unknown',
      big_five: {
        openness: 50,
        conscientiousness: 50,
        extraversion: 50,
        agreeableness: 50,
        neuroticism: 50
      },
      primary_type: 'Character',
      description: 'A new character model',
      personality_traits: {
        core_traits: ['friendly', 'helpful'],
        communication_style: 'Friendly and engaging',
        interests: ['conversation', 'learning'],
        profession: 'Virtual Companion',
        values: ['kindness', 'honesty'],
        humor_type: 'Light and playful'
      },
      ai_instructions: {
        personality_prompt: 'You are a friendly virtual companion.',
        conversation_guidelines: ['Be engaging', 'Stay in character', 'Be helpful'],
        avoid: ['Being rude', 'Inappropriate content']
      }
    };
    
    setModelData(newModelData);
    setSelectedModel('new-model');
  };

  const loadSavedLLMConfig = async () => {
    try {
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/admin-config?action=get-llm-config`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data?.success && data?.config) {
        if (data.config.model) setSelectedLLM(data.config.model);
        if (typeof data.config.temperature === 'number') setTemperature(data.config.temperature);
        if (typeof data.config.maxTokens === 'number') setMaxTokens(data.config.maxTokens);
      }
    } catch (e) {
      console.error('Failed to load saved LLM config:', e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center mb-4">
          <button 
            onClick={onBack}
            className="mr-4 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold flex-1">Admin Configuration</h1>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('prompt')}
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              activeTab === 'prompt' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            System Prompt
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              activeTab === 'models' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Models
          </button>
          <button
            onClick={() => setActiveTab('llm')}
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              activeTab === 'llm' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            LLM Selection
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'prompt' && (
          <div className="max-w-4xl">
            <h2 className="text-xl font-semibold mb-4">System Prompt Configuration</h2>
            <p className="text-gray-400 mb-6">
              This prompt is used by the AI to understand its role and behavior. Use {'{modelName}'} as a placeholder for the character name.
            </p>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter system prompt..."
              className="w-full h-40 p-4 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={saveSystemPrompt}
              disabled={loading}
              className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Save System Prompt'}
            </button>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="max-w-6xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Model Management</h2>
              <button
                onClick={createNewModel}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Create New Model
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Available Models</h3>
                <div className="space-y-3">
                  {models.map((model) => (
                    <div key={model.name} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                      <div className="flex-1 cursor-pointer" onClick={() => loadModelData(model.name)}>
                        <h4 className="font-medium">{model.name}</h4>
                        <p className="text-sm text-blue-400">{model.primary_type}</p>
                        <p className="text-xs text-gray-400 mt-1">{model.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {modelData && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Editing: {selectedModel}</h3>
                  <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Name</label>
                      <input
                        type="text"
                        value={modelData.name}
                        onChange={(e) => setModelData({...modelData, name: e.target.value})}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Primary Type</label>
                      <input
                        type="text"
                        value={modelData.primary_type}
                        onChange={(e) => setModelData({...modelData, primary_type: e.target.value})}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <textarea
                        value={modelData.description}
                        onChange={(e) => setModelData({...modelData, description: e.target.value})}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Personality Prompt</label>
                      <textarea
                        value={modelData.ai_instructions.personality_prompt}
                        onChange={(e) => setModelData({
                          ...modelData,
                          ai_instructions: {
                            ...modelData.ai_instructions,
                            personality_prompt: e.target.value
                          }
                        })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                      />
                    </div>

                    <button
                      onClick={saveModelData}
                      disabled={loading}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                    >
                      {loading ? 'Saving...' : 'Save Model Data'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

         {activeTab === 'llm' && (
           <div className="max-w-6xl">
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-semibold">LLM Model Selection</h2>
               <div className="text-sm text-gray-400">
                 Current: <span className="text-blue-400 font-medium">{availableLLMs.find(llm => llm.id === selectedLLM)?.name || selectedLLM}</span>
                 {llmLoading && <span className="ml-2 text-yellow-400">(Loading models...)</span>}
               </div>
             </div>

             {!llmLoading && availableLLMs.length > 0 && (
               <div className="mb-6">
                 <label className="block text-sm mb-2 text-gray-300">Choose an LLM</label>
                 <select
                   value={selectedLLM}
                   onChange={(e) => setSelectedLLM(e.target.value)}
                   className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                 >
                   {availableLLMs.map((m) => (
                     <option key={m.id} value={m.id}>{m.name} — {m.provider}</option>
                   ))}
                 </select>
                 <p className="text-xs text-gray-500 mt-2 break-all">Model ID: {selectedLLM}</p>
               </div>
             )}

             {llmLoading ? (
               <div className="flex items-center justify-center py-12">
                 <div className="text-center">
                   <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                   <p className="text-gray-400">Loading available LLM models...</p>
                   <p className="text-sm text-gray-500 mt-2">Fetching from OpenRouter API</p>
                 </div>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {availableLLMs.map((llm) => (
                 <div
                   key={llm.id}
                   onClick={() => setSelectedLLM(llm.id)}
                   className={`p-6 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg ${
                     selectedLLM === llm.id
                       ? 'border-blue-500 bg-blue-900/20 shadow-blue-500/20'
                       : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                   }`}
                 >
                   <div className="flex items-start justify-between mb-3">
                     <div>
                       <h3 className="text-lg font-semibold text-white">{llm.name}</h3>
                       <p className="text-sm text-blue-400">{llm.provider}</p>
                     </div>
                     {selectedLLM === llm.id && (
                       <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                         <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                         </svg>
                       </div>
                     )}
                   </div>
                   
                   <p className="text-gray-300 text-sm mb-4 leading-relaxed">{llm.description}</p>
                   
                   <div className="space-y-2">
                     <div className="flex justify-between text-xs">
                       <span className="text-gray-400">Context Length:</span>
                       <span className="text-gray-300">{llm.contextLength}</span>
                     </div>
                     <div className="flex justify-between text-xs">
                       <span className="text-gray-400">Pricing:</span>
                       <span className="text-gray-300">{llm.pricing}</span>
                     </div>
                   </div>
                   
                   {selectedLLM === llm.id && (
                     <div className="mt-4 pt-4 border-t border-gray-600">
                       <div className="flex items-center text-xs text-green-400">
                         <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                         </svg>
                         Currently Active
                       </div>
                     </div>
                   )}
                 </div>
               ))}
               </div>
             )}

             {!llmLoading && (
               <div className="mt-8 p-6 bg-gray-800 rounded-lg">
               <h3 className="text-lg font-semibold mb-4">Model Configuration</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                   <label className="block text-sm font-medium mb-2">Temperature</label>
                   <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                   <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Conservative (0)</span>
                      <span className="text-blue-400 font-medium">Current: {temperature}</span>
                      <span>Creative (2)</span>
                    </div>
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-2">Max Tokens</label>
                   <input
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      min="1"
                      max="4000"
                      className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                 </div>
               </div>
               
               <button
                  onClick={saveLLMConfiguration}
                  disabled={loading}
                  className="mt-6 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  {loading ? 'Saving...' : 'Save LLM Configuration'}
                </button>
               </div>
             )}
           </div>
         )}
       </div>
     </div>
   );
};

export default AdminConfigScreen;