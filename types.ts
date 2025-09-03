export type GameState = 'start' | 'playing' | 'end' | 'winners' | 'chat' | 'modelList';

export type SwipeDirection = 'left' | 'right';

export interface BattleImage {
  url: string;
  name: string;
}

export interface ModelProfile {
  name: string;
  profileImage: string;
  backgroundStory: string;
  sfwImages: string[];
  nsfwImages: string[];
}

export interface CustomPhotoRequest {
  id: string;
  modelName: string;
  requestText: string;
  userEmail: string;
  photoType: 'sfw' | 'bikini' | 'lingerie' | 'topless' | 'nude';
  tokenCost: number;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  createdAt: string;
}

export interface TokenPurchaseOption {
  id: string;
  tokens: number;
  price: number;
  bonus: number;
  popular?: boolean;
}

export interface UserTokens {
  balance: number;
  lastUpdated: Date;
}

export interface ChatSession {
  modelName: string;
  startTime: Date;
  endTime: Date;
  remainingMinutes: number;
  tokenCost: number;
}

export const PRICING = {
  PHOTOS: {
    sfw: { tokens: 2, price: 0.50, label: 'SFW' },
    bikini: { tokens: 2, price: 0.50, label: 'Bikini' },
    lingerie: { tokens: 2, price: 0.50, label: 'Lingerie' },
    topless: { tokens: 3, price: 0.75, label: 'Topless' },
    nude: { tokens: 4, price: 1.00, label: 'Nude' }
  },
  CHAT: {
    // Free entry session: 15 minutes, no tokens required
    sfw: { tokens: 0, price: 0.00, minutes: 15, label: 'SFW Chat (Free 15 min)' },
    nsfw: { tokens: 0, price: 0.00, minutes: 15, label: 'NSFW Chat (Free 15 min)' }
  },
  PASSES: {
    // Day pass for SFW chat
    sfw_day: { tokens: 4, price: 1.00, durationHours: 24, label: 'SFW 24h Pass' },
    // Subscriptions (billing handled externally)
    sfw_month: { tokens: 0, price: 5.00, subscription: true, label: 'SFW Monthly Unlimited' },
    nsfw_month: { tokens: 0, price: 10.00, subscription: true, label: 'NSFW Monthly Unlimited' }
  }
} as const;

export type ChatMode = 'sfw' | 'nsfw';

// Memory System Types
export interface MemoryNugget {
  id: string;
  userId: string;
  modelName: string;
  content: string;
  type: 'anchor' | 'trigger';
  category: 'personal' | 'relationship' | 'preferences' | 'emotional' | 'situational';
  clarity: number; // 0-100, only for triggers
  createdAt: Date;
  lastAccessed: Date;
  tags: string[];
}

export interface MemoryContext {
  anchors: MemoryNugget[];
  triggers: MemoryNugget[];
  recentMemories: MemoryNugget[];
}

export interface ModelPersonality {
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
  intimate_profile: {
    romantic_orientation: string;
    relationship_style: string;
    turn_ons: string[];
    turn_offs: string[];
    kinks_and_curiosities: string[];
  };
  chat_behavior: {
    flirting_style: string;
    conversation_starters: string[];
    passionate_topics: string[];
    response_to_compliments: string;
    typical_responses: {
      greeting_general: string;
      greeting_subscriber: string;
      compliment_received: string;
      flirty_message: string;
      goodbye: string;
    };
    upsell_tease_hooks: string[];
    roleplay_starters: string[];
  };
  voice_profile: {
    tone: string;
    pace: string;
    accent: string;
    pitch: string;
    speaking_patterns: string[];
    signature_phrases: string[];
    laugh_style: string;
    voice_characteristics: {
      breathiness: string;
      warmth: string;
      confidence: string;
      playfulness: string;
    };
  };
  ai_instructions: {
    personality_prompt: string;
    conversation_guidelines: string[];
    avoid: string[];
  };
}
