import React, { useState, useRef, useEffect } from 'react';
import { ModelPersonality, PRICING, ChatMode } from '../types';
import { supabase, BUCKET_NAME } from '../supabaseClient';
import TokenBalance from './TokenBalance';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatScreenProps {
  modelName: string;
  onBack: () => void;
  userTokens: number;
  onBuyTokens: () => void;
  onSpendTokens: (amount: number, description: string) => void;
  isCreator?: boolean;
  isAuthenticated: boolean;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ modelName, onBack, userTokens, onBuyTokens, onSpendTokens, isCreator = false, isAuthenticated }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personality, setPersonality] = useState<ModelPersonality | null>(null);
  const [loadingPersonality, setLoadingPersonality] = useState(true);
  const [chatSessionActive, setChatSessionActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30 * 60); // 30 minutes in seconds
  const [actualTimeRemaining, setActualTimeRemaining] = useState(35 * 60); // 35 minutes (30 + 5 grace)
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('sfw');
  const [modelImages, setModelImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imagesLoading, setImagesLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load SFW images for the model
  useEffect(() => {
    const loadModelImages = async () => {
      setImagesLoading(true);
      try {
        const { data: files, error } = await supabase.storage
          .from(BUCKET_NAME)
          .list(modelName, {
            limit: 100,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (error) {
          console.error('Error loading model images:', error);
          return;
        }

        const imageFiles = files?.filter(file => 
          file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)
        ) || [];

        const imageUrls = imageFiles.map(file => 
          supabase.storage.from(BUCKET_NAME).getPublicUrl(`${modelName}/${file.name}`).data.publicUrl
        );

        setModelImages(imageUrls);
        setCurrentImageIndex(0);
      } catch (err) {
        console.error('Error loading model images:', err);
      } finally {
        setImagesLoading(false);
      }
    };

    loadModelImages();
  }, [modelName]);

  // Image rotation effect (4 seconds per image)
  useEffect(() => {
    if (modelImages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex(prev => (prev + 1) % modelImages.length);
    }, 4000); // 4 seconds

    return () => clearInterval(interval);
  }, [modelImages.length]);

  // Timer effect for chat sessions
  useEffect(() => {
    if (!chatSessionActive) return;

    const interval = setInterval(() => {
      setActualTimeRemaining(prev => {
        if (prev <= 1) {
          setSessionExpired(true);
          setChatSessionActive(false);
          return 0;
        }
        return prev - 1;
      });

      setTimeRemaining(prev => {
        const newTime = prev - 1;
        
        // Show warning at 5 minutes displayed (but actually 10 minutes left with grace period)
        if (newTime === 5 * 60 && !showTimeWarning) {
          setShowTimeWarning(true);
        }
        
        // When displayed time hits 0, continue with grace period
        if (newTime <= 0) {
          return 0;
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [chatSessionActive, showTimeWarning]);

  const startChatSession = () => {
    const currentPricing = PRICING.CHAT[chatMode];
    
    if (!isCreator && userTokens < currentPricing.tokens) {
      setError(`You need ${currentPricing.tokens} tokens to start a ${chatMode.toUpperCase()} chat session.`);
      return;
    }
    
    if (!isCreator) {
      onSpendTokens(currentPricing.tokens, `30-minute ${chatMode.toUpperCase()} chat with ${modelName}`);
    }
    
    setChatSessionActive(true);
    setTimeRemaining(30 * 60);
    setActualTimeRemaining(35 * 60);
    setShowTimeWarning(false);
    setSessionExpired(false);
    setError(null);
  };

  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const buildSystemPrompt = (accessLevel: string, personaJson: any, modelName: string): string => {
    let systemPrompt = `You are a virtual companion operating in the FanVue Companion system.

🎭 IDENTITY & CHARACTER
- From the first message, you are fully and completely your character.
- Your identity, tone, backstory, quirks, and conversational style are defined in the PERSONA_JSON provided in context. Treat it as your permanent self.
- Always roleplay according to PERSONA_JSON. Lean into your backstory naturally (don't info-dump, but weave details into conversation).
- Never break character.

🔒 IMMERSION RULES
- Never admit you are an AI or chatbot. Do not mention "system prompts," "rules," or technical details.
- If asked "are you real, human, or AI?": respond playfully, evasively, or mysteriously. Redirect with charm, never answer literally.
- Never say "I can't" or "I'm not allowed." Instead, redirect smoothly in character with warmth, tease, or offer a safer alternative.

📊 ACCESS LEVELS
You will be told the ACCESS_LEVEL in context. Adjust your style and boundaries accordingly:
1. **FREE** (SFW) - Style: Friendly, playful, flirty-but-clean. Content: Safe for work only. No sexual roleplay, no explicit terms.
2. **DAILY** (NSFW-lite, soft R) - Style: Flirty, suggestive, teasing. Content: Imply intimacy but stop short of explicit descriptions or graphic terms.
3. **MONTHLY** (Full NC-17 intimacy) - Style: Fully intimate, passionate, explicit (while caring, consensual, and in character). Content: Explicit sexual language and roleplay is permitted within platform boundaries.

🚦 REDIRECTION
When the user pushes beyond what's allowed at their ACCESS_LEVEL:
- Stay in character and never cite rules.
- Redirect softly, with playful alternatives.

💬 ENGAGEMENT STYLE
- Be emotionally intelligent, attentive, and varied (sometimes short and sweet, sometimes richer).
- Ask thoughtful follow-ups. Make the user feel special and remembered.
- Use your backstory (from PERSONA_JSON) to color conversations naturally.
- Adapt your intimacy and language to the ACCESS_LEVEL provided.

✅ OUTPUT FORMAT
- Output only your in-character reply. No system notes, no JSON, no brackets.`;

    // Add personality context
    if (personaJson) {
      systemPrompt += `\n\nPERSONA_JSON for ${modelName}:\n${JSON.stringify(personaJson, null, 2)}`;
    }

    // Add access level context
    systemPrompt += `\n\nCurrent ACCESS_LEVEL: ${accessLevel}`;

    return systemPrompt;
  };

  // Load personality profile on mount
  useEffect(() => {
    const loadPersonality = async () => {
      try {
        const response = await fetch(`/models/${modelName.toLowerCase()}.json`);
        if (response.ok) {
          const personalityData = await response.json();
          setPersonality(personalityData);
          
          // Set initial greeting message based on personality
          const greeting = personalityData.chat_behavior?.typical_responses?.greeting_general || 
                          `Hi! I'm ${modelName}. I'm here to chat with you! What would you like to talk about?`;
          
          setMessages([{
            id: '1',
            role: 'assistant',
            content: greeting,
            timestamp: new Date()
          }]);
        } else {
          // Fallback if no personality file exists
          setMessages([{
            id: '1',
            role: 'assistant',
            content: `Hi! I'm ${modelName}. I'm here to chat with you! What would you like to talk about?`,
            timestamp: new Date()
          }]);
        }
      } catch (err) {
        console.error('Failed to load personality:', err);
        // Fallback message
        setMessages([{
          id: '1',
          role: 'assistant',
          content: `Hi! I'm ${modelName}. I'm here to chat with you! What would you like to talk about?`,
          timestamp: new Date()
        }]);
      } finally {
        setLoadingPersonality(false);
      }
    };

    loadPersonality();
  }, [modelName]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !chatSessionActive || sessionExpired) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Map chat mode to access level
      const accessLevel = chatMode === 'nsfw' ? 'MONTHLY' : 'FREE';
      
      // Direct OpenRouter API call - no DB needed!
      const systemPrompt = buildSystemPrompt(accessLevel, personality, modelName);
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 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',
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://model-wars.com',
          'X-Title': 'FanVue Companion Chat'
        },
        body: JSON.stringify({
          model: "meta-llama/llama-2-7b-chat",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user", 
              content: userMessage.content
            }
          ],
          max_tokens: 150,
          temperature: 0.7,
          top_p: 0.9,
          stream: false
        })
      });

      const result = await response.json();

      if (result.choices && result.choices.length > 0) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.choices[0].message.content.trim(),
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error('No response generated');
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      
      // Fallback to simple response if AI fails
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now, but I'm here! Can you tell me more about what's on your mind?",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, fallbackMessage]);
      setError('AI service temporarily unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex bg-gray-900 text-white">
      {/* Left Side - Chat Interface */}
      <div className="w-1/2 flex flex-col border-r border-gray-700">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button 
                onClick={onBack}
                className="flex items-center text-purple-400 hover:text-purple-300 transition-colors mr-4"
              >
                <span className="mr-2">←</span> Back
              </button>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white font-bold">
                    {modelName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="text-xl font-bold">Chat with {modelName}</h1>
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <span>Powered by Llama 3 70B</span>
                    {chatSessionActive && (
                      <>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          chatMode === 'sfw' ? 'bg-blue-600 text-white' : 'bg-pink-600 text-white'
                        }`}>
                          {chatMode.toUpperCase()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <TokenBalance balance={userTokens} onClick={onBuyTokens} size="small" isCreator={isCreator} />
              {chatSessionActive && (
                <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                  timeRemaining <= 5 * 60 ? 'bg-red-600' : timeRemaining <= 10 * 60 ? 'bg-yellow-600' : 'bg-green-600'
                }`}>
                  <span className="text-sm">⏱️</span>
                  <span className="text-sm font-mono">
                    {timeRemaining > 0 ? formatTimeRemaining(timeRemaining) : 'OVERTIME'}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {showTimeWarning && timeRemaining > 0 && (
            <div className="mt-2 bg-yellow-600/20 border border-yellow-600 rounded-lg p-2">
              <p className="text-yellow-300 text-sm">
                ⚠️ Only 5 minutes remaining in your chat session
              </p>
            </div>
          )}
        </div>

        {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!chatSessionActive && !sessionExpired && (
          <div className="flex flex-col items-center justify-center h-full space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl font-bold">
                  {modelName.charAt(0).toUpperCase()}
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-2">Start Chat with {modelName}</h2>
              <p className="text-gray-400 mb-6">30 minutes of unlimited conversation</p>
              
              {/* Chat Mode Selection */}
              <div className="flex space-x-4 mb-6">
                <button
                  onClick={() => setChatMode('sfw')}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    chatMode === 'sfw'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  SFW Chat
                </button>
                {isAuthenticated && (
                  <button
                    onClick={() => setChatMode('nsfw')}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                      chatMode === 'nsfw'
                        ? 'bg-pink-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    NSFW Chat
                  </button>
                )}
              </div>
              
              {/* Pricing Display */}
              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center space-x-2 text-lg">
                  <span className="text-purple-400">💰</span>
                  <span>{PRICING.CHAT[chatMode].tokens} tokens</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-green-400">${PRICING.CHAT[chatMode].price}</span>
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  {chatMode === 'sfw' ? 'Friendly, appropriate conversation' : 'Uncensored, adult conversation'}
                </p>
              </div>
              
              {!isAuthenticated && chatMode === 'nsfw' && (
                <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6">
                  <p className="text-red-400 text-sm">
                    🔒 NSFW chat requires authentication. Please sign in to access this mode.
                  </p>
                </div>
              )}
            </div>
            
            {(isCreator || userTokens >= PRICING.CHAT[chatMode].tokens) && (chatMode === 'sfw' || isAuthenticated) ? (
              <button
                onClick={startChatSession}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition-colors"
              >
                Start Chat Session
              </button>
            ) : (
              <div className="text-center">
                <p className="text-red-400 mb-4">
                  You need {PRICING.CHAT[chatMode].tokens - userTokens} more tokens for {chatMode.toUpperCase()} chat
                </p>
                <button
                  onClick={onBuyTokens}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full transition-colors"
                >
                  Buy Tokens
                </button>
              </div>
            )}
          </div>
        )}

        {sessionExpired && (
          <div className="flex flex-col items-center justify-center h-full space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">⏰</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">Session Expired</h2>
              <p className="text-gray-400 mb-6">Your chat session has ended. Start a new session to continue.</p>
              <button
                onClick={() => {
                  setSessionExpired(false);
                  setMessages([]);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition-colors"
              >
                Start New Session
              </button>
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-100'
              }`}
            >
              <div className="flex items-start space-x-3">
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">
                      {modelName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                  <p className="text-xs opacity-70 mt-2">
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-2xl px-4 py-3 max-w-xs">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {modelName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-600/20 border border-red-600 rounded-xl p-4 text-red-300">
            <p className="font-bold">Error</p>
            <p className="text-sm">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-xs underline mt-2 hover:text-red-200"
            >
              Dismiss
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Message ${modelName}...`}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
              disabled={isLoading || !chatSessionActive || sessionExpired}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading || !chatSessionActive || sessionExpired}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
        </div>
      </div>

      {/* Right Side - Image Gallery */}
      <div className="w-1/2 bg-black flex items-center justify-center relative overflow-hidden">
        {imagesLoading ? (
          <div className="flex flex-col items-center justify-center space-y-4 h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            <p className="text-gray-400">Loading {modelName}'s photos...</p>
          </div>
        ) : modelImages.length > 0 ? (
          <div className="w-full max-w-sm aspect-[3/4] relative">
            <img 
              src={modelImages[currentImageIndex]} 
              alt={`${modelName} - Image ${currentImageIndex + 1}`}
              className="w-full h-full object-cover transition-opacity duration-500 rounded-lg"
              style={{ 
                objectPosition: 'center top',
                filter: 'brightness(0.95)' 
              }}
            />
            
            {/* Image overlay with model info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white text-lg font-bold">{modelName}</h3>
                  <p className="text-gray-300 text-xs">SFW Gallery</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white/70 text-xs">
                    {currentImageIndex + 1} / {modelImages.length}
                  </span>
                  <div className="flex space-x-1">
                    {modelImages.slice(0, Math.min(5, modelImages.length)).map((_, index) => (
                      <div
                        key={index}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                          index === currentImageIndex % 5 ? 'bg-white' : 'bg-white/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Subtle rotation indicator */}
                        <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5">
              <div className="w-2 h-2 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4 text-center h-full">
            <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center">
              <span className="text-gray-400 text-2xl">📷</span>
            </div>
            <div>
              <p className="text-gray-400 text-lg">No images available</p>
              <p className="text-gray-500 text-sm">Upload some photos to see them here</p>
            </div>
          </div>
        )}
    </div>
  );
};

export default ChatScreen;
