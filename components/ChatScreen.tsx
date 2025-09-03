import React, { useState, useRef, useEffect } from 'react';
import { ModelPersonality, PRICING, ChatMode } from '../types';
import { supabase, BUCKET_NAME } from '../supabaseClient';
import TokenBalance from './TokenBalance';
import { memoryService } from '../services/memoryService';
import { spatialMemoryService } from '../services/spatialMemoryService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  kind?: 'text' | 'image';
  imageUrl?: string;
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
  const CHAT_IMAGE_COST = 2;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personality, setPersonality] = useState<ModelPersonality | null>(null);
  const [loadingPersonality, setLoadingPersonality] = useState(true);
  const [chatSessionActive, setChatSessionActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60); // 15 minutes in seconds
  const [actualTimeRemaining, setActualTimeRemaining] = useState(20 * 60); // 20 minutes (15 + 5 grace)
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('nsfw'); // Default to full freedom
  const [modelImages, setModelImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imagesLoading, setImagesLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingImageOffer, setPendingImageOffer] = useState<{ prompt: string } | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showMobileImages, setShowMobileImages] = useState(false);

  const downloadAsJpg = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl, { mode: 'cors' });
      const webpBlob = await response.blob();
      const bitmap = await createImageBitmap(webpBlob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unsupported');
      ctx.drawImage(bitmap, 0, 0);
      const jpegBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))), 'image/jpeg', 0.92);
      });
      const url = URL.createObjectURL(jpegBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('JPEG download failed:', e);
      alert('Download failed. Please try again.');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Extract detailed context from recent conversation for image generation
  const extractClothingAndActivity = (messages: Message[]): string => {
    // Look at the last 10 messages for more context
    const recentMessages = messages.slice(-10);
    
    // Get all assistant messages (AI describing herself)
    const assistantMessages = recentMessages
      .filter(m => m.role === 'assistant')
      .map(m => m.content);
    
    let clothingDescription = '';
    let locationDescription = '';
    let activityDescription = '';
    let moodDescription = '';
    
    // Enhanced keywords for better context extraction
    const clothingKeywords = [
      'wearing', 'dressed in', 'outfit', 'clothes', 'shirt', 'blouse', 'dress', 'skirt', 'pants', 'jeans', 
      'shorts', 'top', 'sweater', 'jacket', 'coat', 'bikini', 'swimsuit', 'lingerie', 'underwear', 
      'bra', 'panties', 'stockings', 'heels', 'shoes', 'boots', 'sandals', 'jewelry', 'necklace', 
      'earrings', 'bracelet', 'ring', 'watch', 'hat', 'cap', 'scarf', 'gloves', 'sunglasses',
      'black', 'white', 'red', 'blue', 'green', 'pink', 'purple', 'yellow', 'gray', 'brown',
      'silk', 'cotton', 'lace', 'leather', 'denim', 'satin', 'velvet', 'linen', 'tight', 'loose',
      'short', 'long', 'sleeveless', 'sleeved', 'strapless', 'v-neck', 'crew neck'
    ];
    
    const locationKeywords = [
      'at the', 'in the', 'on the', 'beach', 'pool', 'park', 'home', 'kitchen', 'bedroom', 'bathroom', 
      'office', 'restaurant', 'cafe', 'bar', 'club', 'gym', 'yoga', 'studio', 'garden', 'balcony',
      'living room', 'dining room', 'shower', 'bath', 'bed', 'couch', 'chair', 'desk', 'mirror',
      'outside', 'indoors', 'outdoors', 'sunset', 'sunrise', 'morning', 'afternoon', 'evening', 'night'
    ];
    
    const activityKeywords = [
      'sitting', 'standing', 'lying', 'walking', 'running', 'dancing', 'swimming', 'cooking', 
      'reading', 'writing', 'working', 'studying', 'exercising', 'yoga', 'stretching', 'posing',
      'relaxing', 'resting', 'sleeping', 'waking up', 'getting ready', 'getting dressed',
      'looking in the mirror', 'applying makeup', 'brushing hair', 'drinking', 'eating'
    ];
    
    const moodKeywords = [
      'happy', 'sad', 'excited', 'relaxed', 'tired', 'energetic', 'confident', 'shy', 'playful',
      'serious', 'flirty', 'romantic', 'mysterious', 'cheerful', 'calm', 'nervous', 'proud'
    ];
    
    // Process messages in reverse order (most recent first)
    for (let i = assistantMessages.length - 1; i >= 0; i--) {
      const message = assistantMessages[i];
      const lowerMessage = message.toLowerCase();
      
      // Extract clothing context
      if (!clothingDescription) {
        const clothingSentences = message.split(/[.!?]/).filter(sentence => {
          const lowerSentence = sentence.toLowerCase();
          return clothingKeywords.some(keyword => lowerSentence.includes(keyword));
        });
        
        if (clothingSentences.length > 0) {
          clothingDescription = clothingSentences.join('. ').trim();
        }
      }
      
      // Extract location context
      if (!locationDescription) {
        const locationSentences = message.split(/[.!?]/).filter(sentence => {
          const lowerSentence = sentence.toLowerCase();
          return locationKeywords.some(keyword => lowerSentence.includes(keyword));
        });
        
        if (locationSentences.length > 0) {
          locationDescription = locationSentences.join('. ').trim();
        }
      }
      
      // Extract activity context
      if (!activityDescription) {
        const activitySentences = message.split(/[.!?]/).filter(sentence => {
          const lowerSentence = sentence.toLowerCase();
          return activityKeywords.some(keyword => lowerSentence.includes(keyword));
        });
        
        if (activitySentences.length > 0) {
          activityDescription = activitySentences.join('. ').trim();
        }
      }
      
      // Extract mood context
      if (!moodDescription) {
        const moodSentences = message.split(/[.!?]/).filter(sentence => {
          const lowerSentence = sentence.toLowerCase();
          return moodKeywords.some(keyword => lowerSentence.includes(keyword));
        });
        
        if (moodSentences.length > 0) {
          moodDescription = moodSentences.join('. ').trim();
        }
      }
    }
    
    // Build comprehensive context
    let context = '';
    if (clothingDescription) {
      context += `Wearing: ${clothingDescription}. `;
    }
    if (locationDescription) {
      context += `Location: ${locationDescription}. `;
    }
    if (activityDescription) {
      context += `Activity: ${activityDescription}. `;
    }
    if (moodDescription) {
      context += `Mood: ${moodDescription}. `;
    }
    
    return context.trim() || 'No specific context mentioned in recent conversation';
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

  // Test memory system function
  const testMemorySystem = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('Testing memory system...');
        
        // Test extraction
        const testMessage = "Hi, my name is Steve and I have 2 kids";
        const nuggets = memoryService.extractMemoryNuggets(testMessage, user.id, modelName);
        console.log('Extracted nuggets:', nuggets);
        
        // Test storage
        if (nuggets.length > 0) {
          await memoryService.storeMemoryNuggets(nuggets);
        }
        
        // Test retrieval
        const context = await memoryService.getMemoryContext(user.id, modelName);
        console.log('Retrieved context:', context);
      }
    } catch (error) {
      console.error('Memory system test failed:', error);
    }
  };

  const startChatSession = async () => {
    const currentPricing = PRICING.CHAT.nsfw; // Always use full freedom pricing
    
    // Free 15 minutes for everyone (no tokens required)
    if (!isCreator && userTokens < currentPricing.tokens) {
      // This should never happen since tokens are 0 for free chat, but keeping as safety
      setError(`You need ${currentPricing.tokens} tokens to start a full freedom chat session.`);
      return;
    }
    
    // No tokens spent for free 15-minute session
    if (!isCreator && currentPricing.tokens > 0) {
      onSpendTokens(currentPricing.tokens, `15-minute full freedom chat with ${modelName}`);
    }
    
    // Generate a unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentSessionId(sessionId);
    
    // Initialize spatial memory for this session
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await spatialMemoryService.initializeSessionState(user.id, modelName, sessionId);
        await spatialMemoryService.initializeSpatialMemory(user.id, modelName, sessionId);
      }
    } catch (error) {
      console.error('Error initializing spatial memory:', error);
    }
    
    setChatSessionActive(true);
    setTimeRemaining(15 * 60); // 15 minutes free
    setActualTimeRemaining(20 * 60); // 15 + 5 grace period
    setShowTimeWarning(false);
    setSessionExpired(false);
    setError(null);
  };

  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };



  // Load personality profile on mount (via admin-config function)
  useEffect(() => {
    const loadPersonality = async () => {
      try {
        const response = await fetch('https://qmclolibbzaeewssqycy.supabase.co/functions/v1/admin-config?action=get-model-data', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xvbGliYnphZWV3c3NxeWN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjQzOTksImV4cCI6MjA3MDk0MDM5OX0.CDn_kCXJ1h5qnd3OkcX2f8P_98PKbteiwsDO7DL2To4`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ modelName })
        });
        if (!response.ok) throw new Error('Failed to load model persona');
        const data = await response.json();
        if (data?.success && data?.model) {
          setPersonality(data.model);
        }
      } catch (err) {
        console.error('Failed to load personality:', err);
        // Don't set fallback message - let user start the chat
      } finally {
        setLoadingPersonality(false);
      }
    };

    loadPersonality();
  }, [modelName]);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Extract and store memory nuggets from user message
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const memoryNuggets = memoryService.extractMemoryNuggets(
          userMessage.content, 
          user.id, 
          modelName
        );
        if (memoryNuggets.length > 0) {
          await memoryService.storeMemoryNuggets(memoryNuggets);
        }
      }
    } catch (error) {
      console.error('Error processing memory nuggets:', error);
    }

    // If the user is asking for a selfie/picture, offer custom image flow
    const text = userMessage.content.toLowerCase();
    const mentionsImage = /(selfie|pic|picture|photo|image|snapshot)/i.test(text);
    const asksForIt = /(s?end|share|show|take|snap|dm|post|give|get|see|can|could|will|would|may|please|pls)/i.test(text);
    const wantsImage = mentionsImage && (asksForIt || text.includes('?'));
    if (wantsImage) {
      const assistantOffer: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Actually… I can. They charge me ${CHAT_IMAGE_COST} tokens to send one. Can you cover that? If yes, tell me what kind of pose or vibe you want and I’ll snap it for you.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantOffer]);
      setPendingImageOffer({ prompt: userMessage.content });
      setIsLoading(false);
      return;
    }

    // Call Supabase Edge Function for AI chat
    try {
      // Get memory context for personalized responses
      let memoryContext = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          memoryContext = await memoryService.getMemoryContext(user.id, modelName);
          console.log('Memory Context Retrieved:', memoryContext);
          
          // Get current spatial memory context and add to memoryContext
          if (currentSessionId) {
            const { sessionState, spatialMemory } = await spatialMemoryService.getCurrentState(
              user.id, 
              modelName, 
              currentSessionId
            );
            
            console.log('Spatial Memory Debug:', { sessionState, spatialMemory, currentSessionId });
            
            // Add spatial memory to the memory context object
            if (memoryContext) {
              // Add spatial memory properties to existing memory context
              (memoryContext as any).sessionState = sessionState;
              (memoryContext as any).spatialMemory = spatialMemory;
            } else {
              memoryContext = {
                anchors: [],
                triggers: [],
                recentMemories: [],
                sessionState: sessionState,
                spatialMemory: spatialMemory
              };
            }
          }
        }
      } catch (error) {
        console.error('Error getting memory context:', error);
      }

      // Include a short rolling history so the model maintains context
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: userMessage.content,
          modelName: modelName,
          // Provide persona JSON and access level so backend can build proper system prompt
          persona: personality || null,
          accessLevel: 'MONTHLY', // Always full freedom
          history,
          memoryContext: memoryContext
        }
      });

      if (response.error) {
        console.error('Supabase Edge Function Error:', response.error);
        throw new Error(`Edge Function Error: ${response.error.message || 'Unknown error'}`);
      }

      const data = response.data;
      console.log('AI Chat Response:', data);
      
      if (data && data.success) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);

        // Extract and update spatial memory from AI response
        if (currentSessionId) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const updates = spatialMemoryService.extractSpatialUpdates(
                data.response, 
                user.id, 
                modelName, 
                currentSessionId
              );

              console.log('Spatial Memory Updates Debug:', { 
                aiResponse: data.response, 
                updates, 
                currentSessionId 
              });

              if (updates.sessionUpdates) {
                await spatialMemoryService.updateSessionState(
                  user.id, 
                  modelName, 
                  currentSessionId, 
                  updates.sessionUpdates
                );
              }

              if (updates.spatialUpdates) {
                await spatialMemoryService.updateSpatialMemory(
                  user.id, 
                  modelName, 
                  currentSessionId, 
                  updates.spatialUpdates
                );
              }
            }
          } catch (error) {
            console.error('Error updating spatial memory:', error);
          }
        }
      } else {
        console.error('AI Chat failed:', data);
        throw new Error(data?.error || 'AI API failed');
      }
    } catch (error) {
      console.error('Frontend chat error:', error);
      
      // Show detailed error for debugging
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error.message || 'AI temporarily unavailable'}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    }
    
    setIsLoading(false);
  };

  const confirmCustomImage = async () => {
    if (!pendingImageOffer) return;
    const cost = CHAT_IMAGE_COST;

    if (!isCreator && userTokens < cost) {
      setError(`You need ${cost} tokens to get a photo.`);
      return;
    }

    try {
      setIsGeneratingImage(true);
      if (!isCreator) {
        onSpendTokens(cost, `Custom chat photo from ${modelName}`);
      }

      // Build photoType based on user's actual request - full freedom
      const userRequest = pendingImageOffer.prompt.toLowerCase();
      let type: 'sfw' | 'bikini' | 'lingerie' | 'topless' | 'nude' = 'sfw';
      
      // Determine type based on user's request with full freedom
      if (userRequest.includes('topless') || userRequest.includes('naked') || userRequest.includes('nude')) {
        type = 'topless';
      } else if (userRequest.includes('bikini') || userRequest.includes('swimsuit') || userRequest.includes('beach')) {
        type = 'bikini';
      } else if (userRequest.includes('lingerie') || userRequest.includes('underwear') || userRequest.includes('sexy')) {
        type = 'lingerie';
      } else if (userRequest.includes('sfw') || userRequest.includes('safe') || userRequest.includes('appropriate')) {
        type = 'sfw';
      } else {
        // Default to lingerie for requests that don't specify
        type = 'lingerie';
      }

      // Extract detailed context from recent chat messages
      const chatContext = extractClothingAndActivity(messages);
      
      // Enhanced prompt with detailed chat context
      const enhancedPrompt = `${pendingImageOffer.prompt}. ${chatContext} Generate a full body picture that accurately reflects the current conversation context, showing the exact clothing, location, and activity described.`;

      // Get user info for image generation
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('Image Generation Debug:', { 
        userRequest: pendingImageOffer.prompt,
        selectedPhotoType: type,
        chatMode: chatMode,
        enhancedPrompt, 
        modelName, 
        userEmail: user?.email, 
        userId: user?.id,
        chatContext 
      });
      
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: enhancedPrompt,
          photoType: type,
          modelName: modelName,
          userEmail: user?.email || '',
          userId: user?.id || null,
          chatContext: chatContext // Pass context separately too
        }
      });

      if (error) throw new Error(error.message || 'Image generation failed');
      if (!data?.success || !data?.imageUrl) throw new Error(data?.error || 'Image generation failed');

      const imgMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `Here you go.`,
        timestamp: new Date(),
        kind: 'image',
        imageUrl: data.imageUrl
      };
      setMessages(prev => [...prev, imgMessage]);
    } catch (e: any) {
      const failMsg: Message = {
        id: (Date.now() + 3).toString(),
        role: 'assistant',
        content: `Image failed: ${e.message || 'please try again shortly.'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, failMsg]);
    } finally {
      setIsGeneratingImage(false);
      setPendingImageOffer(null);
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
    <div className="h-full flex flex-col lg:flex-row bg-gray-900 text-white">
      {/* Chat Interface */}
      <div className="flex-1 lg:w-1/2 flex flex-col border-r-0 lg:border-r border-gray-700">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-3 lg:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0 flex-1">
              <button 
                onClick={onBack}
                className="flex items-center text-purple-400 hover:text-purple-300 transition-colors mr-2 lg:mr-4 flex-shrink-0"
              >
                <span className="mr-1 lg:mr-2">←</span> 
                <span className="hidden sm:inline">Back</span>
              </button>
              <div className="flex items-center min-w-0">
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mr-2 lg:mr-3 flex-shrink-0">
                  <span className="text-white font-bold text-sm lg:text-base">
                    {modelName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg lg:text-xl font-bold truncate">Chat with {modelName}</h1>
                  <div className="flex items-center space-x-1 lg:space-x-2 text-xs lg:text-sm text-gray-400">
                    <span className="hidden sm:inline">Powered by Llama 3 70B</span>
                    <span className="sm:hidden">Llama 3</span>
                    {chatSessionActive && (
                      <>
                        <span>•</span>
                        <span className="px-1 lg:px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-600 text-white">
                          FULL FREEDOM
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 lg:space-x-4 flex-shrink-0">
              {/* Mobile image toggle button */}
              <button
                onClick={() => setShowMobileImages(!showMobileImages)}
                className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
                title="View photos"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              
              <TokenBalance balance={userTokens} onClick={onBuyTokens} size="small" isCreator={isCreator} />
              {chatSessionActive && (
                <div className={`flex items-center space-x-1 lg:space-x-2 px-2 lg:px-3 py-1 rounded-full ${
                  timeRemaining <= 5 * 60 ? 'bg-red-600' : timeRemaining <= 10 * 60 ? 'bg-yellow-600' : 'bg-purple-600'
                }`}>
                  <span className="text-xs lg:text-sm">⏱️</span>
                  <span className="text-xs lg:text-sm font-mono">
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
      <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4">
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
              
              {/* Full Freedom Chat - No Mode Selection */}
              <div className="mb-6">
                <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
                  <p className="text-purple-300 text-sm font-medium">
                    🎉 <strong>Full Freedom Chat</strong> - Uncensored conversation with complete creative freedom
                  </p>
                </div>
              </div>
              
              {/* Pricing Display */}
              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center space-x-2 text-lg">
                  <span className="text-purple-400">💰</span>
                  <span>{PRICING.CHAT.nsfw.tokens} tokens</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-green-400">${PRICING.CHAT.nsfw.price}</span>
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  Uncensored conversation with complete creative freedom
                </p>
              </div>
              

            </div>
            
            {(isCreator || userTokens >= PRICING.CHAT.nsfw.tokens) ? (
              <div className="text-center">
                <div className="bg-green-600/20 border border-green-500/30 rounded-lg p-3 mb-4">
                  <p className="text-green-400 text-sm font-medium">
                    🎉 <strong>15 Minutes FREE</strong> - No tokens required!
                  </p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={startChatSession}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition-colors w-full"
                  >
                    Start FREE Chat Session
                  </button>
                  <button
                    onClick={testMemorySystem}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full transition-colors w-full text-sm"
                  >
                    Test Memory System
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-red-400 mb-4">
                  You need {PRICING.CHAT.nsfw.tokens - userTokens} more tokens for full freedom chat
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
              className={`max-w-[85%] sm:max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl rounded-2xl px-3 lg:px-4 py-2 lg:py-3 ${
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
                  {message.kind === 'image' && message.imageUrl ? (
                    <div className="space-y-2">
                      <img src={message.imageUrl} alt="Generated" className="rounded-lg border border-gray-600" />
                      <p className="text-xs text-gray-300">{message.content}</p>
                      <button
                        onClick={() => downloadAsJpg(message.imageUrl!, `${modelName}_${Date.now()}.jpg`)}
                        className="inline-block text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
                      >
                        Download JPG
                      </button>
                    </div>
                  ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                  )}
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
      <div className="bg-gray-800 border-t border-gray-700 p-3 lg:p-4">
        <div className="flex space-x-2 lg:space-x-3">
          <div className="flex-1 relative">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Message ${modelName}...`}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 lg:px-4 py-2 lg:py-3 pr-10 lg:pr-12 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm lg:text-base"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading || !chatSessionActive || sessionExpired}
              className="absolute right-1 lg:right-2 top-1/2 transform -translate-y-1/2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:opacity-50 text-white p-1.5 lg:p-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
        {pendingImageOffer && (
          <div className="mt-3 p-3 bg-gray-700 rounded-xl border border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Confirm and I’ll send a fresh photo (costs {CHAT_IMAGE_COST} tokens)</span>
              <button
                onClick={() => setPendingImageOffer(null)}
                className="text-xs text-gray-300 hover:text-white"
              >
                Cancel
              </button>
            </div>
            <button
              onClick={confirmCustomImage}
              disabled={isGeneratingImage}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 rounded-lg"
            >
              {isGeneratingImage ? 'Generating…' : `Yes, cover ${CHAT_IMAGE_COST} tokens`}
            </button>
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
        </div>
      </div>

      {/* Image Gallery - Hidden on mobile, shown on desktop */}
      <div className="hidden lg:flex lg:w-1/2 bg-black items-center justify-center relative overflow-hidden">
        <div className="w-full max-w-sm aspect-[3/4] relative">
        {imagesLoading ? (
            <div className="flex flex-col items-center justify-center space-y-4 h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            <p className="text-gray-400">Loading {modelName}'s photos...</p>
          </div>
        ) : modelImages.length > 0 ? (
            <>
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
            </>
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
      </div>

      {/* Mobile Image Overlay */}
      {showMobileImages && (
        <div className="lg:hidden fixed inset-0 bg-black z-50 flex flex-col">
          {/* Mobile image header */}
          <div className="bg-gray-800 p-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">{modelName}'s Photos</h2>
            <button
              onClick={() => setShowMobileImages(false)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Mobile image gallery */}
          <div className="flex-1 flex items-center justify-center p-4">
            {imagesLoading ? (
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                <p className="text-gray-400">Loading {modelName}'s photos...</p>
              </div>
            ) : modelImages.length > 0 ? (
              <div className="w-full max-w-sm aspect-[3/4] relative">
                <img 
                  src={modelImages[currentImageIndex]} 
                  alt={`${modelName} - Image ${currentImageIndex + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                  style={{ 
                    objectPosition: 'center top',
                    filter: 'brightness(0.95)' 
                  }}
                />
                
                {/* Image info overlay */}
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
                    </div>
                  </div>
                </div>

                {/* Navigation arrows */}
                {modelImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex(prev => prev === 0 ? modelImages.length - 1 : prev - 1)}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex(prev => (prev + 1) % modelImages.length)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 text-center">
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
        </div>
      )}
    </div>
  );
};

export default ChatScreen;
