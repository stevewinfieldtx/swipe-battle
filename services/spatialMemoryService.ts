import { supabase } from '../supabaseClient';
import { SessionState, SpatialMemory, MemoryContext } from '../types';

export class SpatialMemoryService {
  private static instance: SpatialMemoryService;
  
  public static getInstance(): SpatialMemoryService {
    if (!SpatialMemoryService.instance) {
      SpatialMemoryService.instance = new SpatialMemoryService();
    }
    return SpatialMemoryService.instance;
  }

  // Initialize session state when conversation starts
  async initializeSessionState(userId: string, modelName: string, sessionId: string): Promise<SessionState> {
    const defaultState: SessionState = {
      id: this.generateId(),
      userId,
      modelName,
      sessionId,
      currentActivity: "chatting with you",
      clothing: {
        top: "comfortable casual top",
        bottom: "comfortable casual bottom", 
        underwear: "matching set",
        accessories: [],
        shoes: "none (barefoot or socks)"
      },
      hairStyle: "natural and styled",
      makeup: "light and natural",
      mood: "happy and engaged",
      energy: 'medium',
      lastUpdated: new Date()
    };

    try {
      const { error } = await supabase
        .from('session_states')
        .insert({
          ...defaultState,
          lastUpdated: defaultState.lastUpdated.toISOString()
        });

      if (error) {
        console.error('Error initializing session state:', error);
      }
    } catch (error) {
      console.error('Error initializing session state:', error);
    }

    return defaultState;
  }

  // Initialize spatial memory when conversation starts
  async initializeSpatialMemory(userId: string, modelName: string, sessionId: string): Promise<SpatialMemory> {
    const defaultSpatial: SpatialMemory = {
      id: this.generateId(),
      userId,
      modelName,
      sessionId,
      bodyPosition: {
        wholeBody: "sitting comfortably",
        leftFoot: "on the floor",
        rightFoot: "on the floor",
        leftHand: "resting naturally",
        rightHand: "resting naturally",
        head: "turned toward you",
        torso: "relaxed and upright"
      },
      proximity: {
        distanceToUser: 'medium',
        touching: [],
        facing: 'toward'
      },
      lastUpdated: new Date()
    };

    try {
      const { error } = await supabase
        .from('spatial_memories')
        .insert({
          ...defaultSpatial,
          lastUpdated: defaultSpatial.lastUpdated.toISOString()
        });

      if (error) {
        console.error('Error initializing spatial memory:', error);
      }
    } catch (error) {
      console.error('Error initializing spatial memory:', error);
    }

    return defaultSpatial;
  }

  // Extract spatial and session updates from AI messages
  extractSpatialUpdates(message: string, userId: string, modelName: string, sessionId: string): {
    sessionUpdates?: Partial<SessionState>;
    spatialUpdates?: Partial<SpatialMemory>;
  } {
    const lowerMessage = message.toLowerCase();
    const updates: any = {};

    // Session State Patterns
    const sessionPatterns = [
      // Clothing changes
      { pattern: /(?:i'm wearing|i have on|i put on|i changed into)\s+([^.!?]+)/i, field: 'clothing' },
      { pattern: /(?:my hair is|i did my hair|i styled my hair)\s+([^.!?]+)/i, field: 'hairStyle' },
      { pattern: /(?:i'm doing|i'm working on|i'm studying|i'm reading)\s+([^.!?]+)/i, field: 'currentActivity' },
      { pattern: /(?:i'm feeling|i feel|my mood is)\s+([^.!?]+)/i, field: 'mood' },
      { pattern: /(?:i'm tired|i'm energetic|i'm relaxed)\s+([^.!?]+)/i, field: 'energy' },
    ];

    // Spatial Position Patterns
    const spatialPatterns = [
      // Body position changes
      { pattern: /(?:i'm sitting|i'm standing|i'm lying|i'm leaning)\s+([^.!?]+)/i, field: 'wholeBody' },
      { pattern: /(?:i put my feet|my feet are|i'm putting my feet)\s+([^.!?]+)/i, field: 'feet' },
      { pattern: /(?:i'm touching|i'm holding|my hand is|i put my hand)\s+([^.!?]+)/i, field: 'hands' },
      { pattern: /(?:i'm looking|i'm facing|my head is|i turned my head)\s+([^.!?]+)/i, field: 'head' },
      { pattern: /(?:i'm leaning|my torso is|i'm sitting up|i'm slouching)\s+([^.!?]+)/i, field: 'torso' },
      { pattern: /(?:i'm close to|i'm near|i'm far from|i moved)\s+([^.!?]+)/i, field: 'proximity' },
    ];

    // Check for session updates
    sessionPatterns.forEach(({ pattern, field }) => {
      const match = message.match(pattern);
      if (match) {
        if (!updates.sessionUpdates) updates.sessionUpdates = {};
        updates.sessionUpdates[field] = match[1].trim();
      }
    });

    // Check for spatial updates
    spatialPatterns.forEach(({ pattern, field }) => {
      const match = message.match(pattern);
      if (match) {
        if (!updates.spatialUpdates) updates.spatialUpdates = {};
        
        if (field === 'feet') {
          if (!updates.spatialUpdates.bodyPosition) updates.spatialUpdates.bodyPosition = {};
          updates.spatialUpdates.bodyPosition.leftFoot = match[1].trim();
          updates.spatialUpdates.bodyPosition.rightFoot = match[1].trim();
        } else if (field === 'hands') {
          if (!updates.spatialUpdates.bodyPosition) updates.spatialUpdates.bodyPosition = {};
          updates.spatialUpdates.bodyPosition.leftHand = match[1].trim();
          updates.spatialUpdates.bodyPosition.rightHand = match[1].trim();
        } else if (field === 'proximity') {
          if (!updates.spatialUpdates.proximity) updates.spatialUpdates.proximity = {};
          if (match[1].includes('close')) updates.spatialUpdates.proximity.distanceToUser = 'close';
          else if (match[1].includes('far')) updates.spatialUpdates.proximity.distanceToUser = 'far';
          else updates.spatialUpdates.proximity.distanceToUser = 'medium';
        } else {
          if (!updates.spatialUpdates.bodyPosition) updates.spatialUpdates.bodyPosition = {};
          updates.spatialUpdates.bodyPosition[field] = match[1].trim();
        }
      }
    });

    return updates;
  }

  // Update session state
  async updateSessionState(userId: string, modelName: string, sessionId: string, updates: Partial<SessionState>): Promise<void> {
    try {
      const { error } = await supabase
        .from('session_states')
        .update({
          ...updates,
          lastUpdated: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('model_name', modelName)
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error updating session state:', error);
      }
    } catch (error) {
      console.error('Error updating session state:', error);
    }
  }

  // Update spatial memory
  async updateSpatialMemory(userId: string, modelName: string, sessionId: string, updates: Partial<SpatialMemory>): Promise<void> {
    try {
      const { error } = await supabase
        .from('spatial_memories')
        .update({
          ...updates,
          lastUpdated: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('model_name', modelName)
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error updating spatial memory:', error);
      }
    } catch (error) {
      console.error('Error updating spatial memory:', error);
    }
  }

  // Get current session state and spatial memory
  async getCurrentState(userId: string, modelName: string, sessionId: string): Promise<{
    sessionState: SessionState | null;
    spatialMemory: SpatialMemory | null;
  }> {
    try {
      const [sessionResult, spatialResult] = await Promise.all([
        supabase
          .from('session_states')
          .select('*')
          .eq('user_id', userId)
          .eq('model_name', modelName)
          .eq('session_id', sessionId)
          .single(),
        supabase
          .from('spatial_memories')
          .select('*')
          .eq('user_id', userId)
          .eq('model_name', modelName)
          .eq('session_id', sessionId)
          .single()
      ]);

      return {
        sessionState: sessionResult.data ? this.mapDbToSessionState(sessionResult.data) : null,
        spatialMemory: spatialResult.data ? this.mapDbToSpatialMemory(spatialResult.data) : null
      };
    } catch (error) {
      console.error('Error getting current state:', error);
      return { sessionState: null, spatialMemory: null };
    }
  }

  // Generate spatial and session context for AI
  generateSpatialContext(sessionState: SessionState | null, spatialMemory: SpatialMemory | null): string {
    let context = '';
    
    if (sessionState) {
      context += `\n\nCURRENT SESSION STATE:\n`;
      context += `- Activity: ${sessionState.currentActivity}\n`;
      context += `- Clothing: ${sessionState.clothing.top}, ${sessionState.clothing.bottom}\n`;
      context += `- Hair: ${sessionState.hairStyle}\n`;
      context += `- Mood: ${sessionState.mood}\n`;
      context += `- Energy: ${sessionState.energy}\n`;
    }

    if (spatialMemory) {
      context += `\n\nCURRENT SPATIAL POSITION:\n`;
      context += `- Body: ${spatialMemory.bodyPosition.wholeBody}\n`;
      context += `- Left foot: ${spatialMemory.bodyPosition.leftFoot}\n`;
      context += `- Right foot: ${spatialMemory.bodyPosition.rightFoot}\n`;
      context += `- Left hand: ${spatialMemory.bodyPosition.leftHand}\n`;
      context += `- Right hand: ${spatialMemory.bodyPosition.rightHand}\n`;
      context += `- Head: ${spatialMemory.bodyPosition.head}\n`;
      context += `- Torso: ${spatialMemory.bodyPosition.torso}\n`;
      context += `- Distance: ${spatialMemory.proximity.distanceToUser}\n`;
      if (spatialMemory.proximity.touching.length > 0) {
        context += `- Touching: ${spatialMemory.proximity.touching.join(', ')}\n`;
      }
    }

    if (context) {
      context += `\nUse this spatial and session information to maintain consistency in your responses. Reference your current position, clothing, and activities naturally.`;
    }

    return context;
  }

  private generateId(): string {
    return `spatial_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapDbToSessionState(dbRecord: any): SessionState {
    return {
      id: dbRecord.id,
      userId: dbRecord.user_id,
      modelName: dbRecord.model_name,
      sessionId: dbRecord.session_id,
      currentActivity: dbRecord.current_activity,
      clothing: dbRecord.clothing,
      hairStyle: dbRecord.hair_style,
      makeup: dbRecord.makeup,
      mood: dbRecord.mood,
      energy: dbRecord.energy,
      lastUpdated: new Date(dbRecord.last_updated)
    };
  }

  private mapDbToSpatialMemory(dbRecord: any): SpatialMemory {
    return {
      id: dbRecord.id,
      userId: dbRecord.user_id,
      modelName: dbRecord.model_name,
      sessionId: dbRecord.session_id,
      bodyPosition: dbRecord.body_position,
      proximity: dbRecord.proximity,
      lastUpdated: new Date(dbRecord.last_updated)
    };
  }
}

export const spatialMemoryService = SpatialMemoryService.getInstance();

