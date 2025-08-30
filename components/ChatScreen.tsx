import React, { useState, useRef, useEffect } from 'react';
import { ModelPersonality, PRICING, ChatMode } from '../types';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      // Generate personality-based response
      setTimeout(() => {
        const userText = userMessage.content.toLowerCase();
        let response = '';
        
        if (personality) {
          // Check for NSFW content in SFW mode
          const nsfwKeywords = ['sex', 'sexy', 'naked', 'nude', 'horny', 'fuck', 'dick', 'pussy', 'boobs', 'tits'];
          const hasNsfwContent = nsfwKeywords.some(keyword => userText.includes(keyword));
          
          if (chatMode === 'sfw' && hasNsfwContent) {
            response = "I'm in SFW mode right now, so I prefer to keep our conversation friendly and appropriate. Let's talk about something else! What else is on your mind?";
          } else if (userText.includes('hello') || userText.includes('hi') || userText.includes('hey')) {
            response = chatMode === 'nsfw' && personality.chat_behavior.typical_responses.greeting_subscriber 
              ? personality.chat_behavior.typical_responses.greeting_subscriber
              : personality.chat_behavior.typical_responses.greeting_general;
          } else if (userText.includes('beautiful') || userText.includes('gorgeous') || userText.includes('pretty')) {
            response = personality.chat_behavior.typical_responses.compliment_received;
          } else if (userText.includes('role play') || userText.includes('roleplay')) {
            response = chatMode === 'nsfw' 
              ? personality.chat_behavior.typical_responses.flirty_message
              : "I love creative conversations! What kind of fun, friendly roleplay scenario did you have in mind?";
          } else if (userText.includes('bye') || userText.includes('goodbye') || userText.includes('later')) {
            response = personality.chat_behavior.typical_responses.goodbye;
          } else if (userText.includes('thank') || userText.includes('thanks')) {
            response = "You're so welcome! Your kindness means a lot to me.";
          } else {
            // Generate responses based on personality traits
            if (modelName.toLowerCase() === 'mai') {
              if (userText.includes('art') || userText.includes('travel') || userText.includes('study')) {
                response = "That's fascinating! You know I'm always curious about new perspectives. Tell me more about that - I love learning from people who are passionate about their interests.";
              } else if (userText.includes('texas') || userText.includes('austin')) {
                response = "Well, shucks! You know about my Texas roots? Y'all are making me feel right at home. What brings that up?";
              } else {
                const responses = [
                  "That's really interesting! You've got me curious now - what's the story there?",
                  "I love how you think! You seem like someone who'd have fascinating stories to share.",
                  "You know what? That reminds me of something I experienced while traveling. Tell me more about your perspective on that."
                ];
                response = responses[Math.floor(Math.random() * responses.length)];
              }
            } else if (modelName.toLowerCase() === 'claudia') {
              if (userText.includes('nature') || userText.includes('mountain') || userText.includes('garden')) {
                response = "Ay, you understand the beauty of la naturaleza. There is something so peaceful about being connected to the earth, no? What is your favorite place in nature?";
              } else if (userText.includes('family') || userText.includes('home')) {
                response = "Family and home... these are the things that matter most. You speak of something close to my heart. Tell me about what home means to you.";
              } else {
                const responses = [
                  "Your words are kind. I like how you see the world... tell me more about what brings you peace.",
                  "La vida es simple, but you make it more beautiful with your thoughts. What else is in your heart today?",
                  "You have a gentle spirit, I can feel it. What is something that made you smile recently?"
                ];
                response = responses[Math.floor(Math.random() * responses.length)];
              }
            } else {
              // Default fallback for models without personalities
              const contextualResponses = [
                `That's really interesting! Tell me more about that.`,
                `I love hearing your thoughts! What else is on your mind?`,
                `You seem really cool! I'm enjoying getting to know you better.`
              ];
              response = contextualResponses[Math.floor(Math.random() * contextualResponses.length)];
            }
          }
        } else {
          // Fallback without personality
          response = `That's interesting! I'd love to hear more about your thoughts on that.`;
        }
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
      }, 1000 + Math.random() * 2000); // 1-3 second delay for realism
      
      return; // Exit early since we're using setTimeout
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      console.error('Chat error:', err);
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
    <div className="h-full flex flex-col bg-gray-900 text-white">
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
  );
};

export default ChatScreen;
