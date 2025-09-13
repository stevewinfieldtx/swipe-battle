import { supabase } from '../supabaseClient';
import { MemoryNugget, MemoryContext } from '../types';

export class MemoryService {
  private static instance: MemoryService;
  
  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  // Extract potential memory nuggets from user messages
  extractMemoryNuggets(message: string, userId: string, modelName: string): MemoryNugget[] {
    const nuggets: MemoryNugget[] = [];
    const lowerMessage = message.toLowerCase();
    
    console.log('=== EXTRACTING MEMORY NUGGETS ===');
    console.log('Message:', message);
    console.log('User ID:', userId, 'Model Name:', modelName);

    // Anchor patterns (permanent identity markers)
    const anchorPatterns = [
      // Personal info - names
      { pattern: /(?:i'm|i am|my name is|call me|i go by)\s+([a-zA-Z\s]+)/i, category: 'personal' as const, type: 'anchor' as const },
      { pattern: /(?:you can call me|just call me)\s+([a-zA-Z\s]+)/i, category: 'personal' as const, type: 'anchor' as const },
      { pattern: /(?:everyone calls me|people call me)\s+([a-zA-Z\s]+)/i, category: 'personal' as const, type: 'anchor' as const },
      
      // Family - kids
      { pattern: /(?:i have|i've got|i got)\s+(\d+)\s+(?:kids?|children)/i, category: 'family' as const, type: 'anchor' as const },
      { pattern: /(?:i have|i've got|i got)\s+(?:a|an|one|two|three|four|five)\s+(?:kid|child|son|daughter|baby|toddler)/i, category: 'family' as const, type: 'anchor' as const },
      { pattern: /(?:my|i have a)\s+(?:son|daughter|kid|child|baby|toddler)\s+(?:named|called)\s+([a-zA-Z\s]+)/i, category: 'family' as const, type: 'anchor' as const },
      { pattern: /(?:i'm a|i am a)\s+(?:parent|mom|dad|mother|father)/i, category: 'family' as const, type: 'anchor' as const },
      
      // Work
      { pattern: /(?:i work as|i'm a|my job is|i do)\s+([a-zA-Z\s]+)/i, category: 'personal' as const, type: 'anchor' as const },
      { pattern: /(?:i work at|i work for)\s+([a-zA-Z\s]+)/i, category: 'personal' as const, type: 'anchor' as const },
      
      // Location
      { pattern: /(?:i live in|i'm from|my hometown is|i'm based in)\s+([a-zA-Z\s]+)/i, category: 'personal' as const, type: 'anchor' as const },
      
      // Relationship status
      { pattern: /(?:i'm married|i'm single|i have a girlfriend|i have a boyfriend|i'm divorced|i'm widowed)/i, category: 'personal' as const, type: 'anchor' as const },
      { pattern: /(?:my wife|my husband|my partner)\s+(?:is|called|named)\s+([a-zA-Z\s]+)/i, category: 'family' as const, type: 'anchor' as const },
      
      // Preferences
      { pattern: /(?:i like|i love|i prefer|my favorite)\s+([a-zA-Z\s]+)/i, category: 'preferences' as const, type: 'anchor' as const },
      { pattern: /(?:i'm into|i'm curious about)\s+([a-zA-Z\s]+)/i, category: 'preferences' as const, type: 'anchor' as const },
    ];

    // Trigger patterns (temporary/situational)
    const triggerPatterns = [
      // Emotional states
      { pattern: /(?:i'm feeling|i feel|i'm stressed|i'm excited|i'm worried)/i, category: 'emotional' as const, type: 'trigger' as const },
      { pattern: /(?:i'm having a bad day|i'm having a great day)/i, category: 'emotional' as const, type: 'trigger' as const },
      
      // Situational
      { pattern: /(?:i'm going to|i have to|i need to|i'm planning to)/i, category: 'situational' as const, type: 'trigger' as const },
      { pattern: /(?:i'm sick|i'm not feeling well|i'm tired)/i, category: 'situational' as const, type: 'trigger' as const },
      { pattern: /(?:my birthday is|i have an interview|i'm moving)/i, category: 'situational' as const, type: 'trigger' as const },
      
      // Family/friends
      { pattern: /(?:my mom|my dad|my family|my friend)/i, category: 'personal' as const, type: 'trigger' as const },
    ];

    // Check anchor patterns
    anchorPatterns.forEach(({ pattern, category, type }) => {
      const match = message.match(pattern);
      if (match) {
        const content = match[1] ? match[1].trim() : match[0].trim();
        if (content && content.length > 2) {
          console.log(`Memory Pattern Matched: "${pattern}" -> "${content}" (${category})`);
          nuggets.push({
            id: this.generateId(),
            userId,
            modelName,
            content,
            type,
            category,
            clarity: 100, // Anchors don't decay
            createdAt: new Date(),
            lastAccessed: new Date(),
            tags: this.extractTags(content)
          });
        }
      }
    });

    // Check trigger patterns
    triggerPatterns.forEach(({ pattern, category, type }) => {
      const match = message.match(pattern);
      if (match) {
        const content = match[1] ? match[1].trim() : match[0].trim();
        if (content && content.length > 2) {
          console.log(`Memory Pattern Matched: "${pattern}" -> "${content}" (${category})`);
          nuggets.push({
            id: this.generateId(),
            userId,
            modelName,
            content,
            type,
            category,
            clarity: 100, // Start at full clarity
            createdAt: new Date(),
            lastAccessed: new Date(),
            tags: this.extractTags(content)
          });
        }
      }
    });

    console.log('=== EXTRACTION COMPLETE ===');
    console.log('Total nuggets extracted:', nuggets.length);
    console.log('Extracted nuggets:', nuggets);
    
    // Test specific patterns manually
    console.log('=== MANUAL PATTERN TESTING ===');
    const testMessage = "My name is Steve and I have 2 kids";
    console.log('Testing message:', testMessage);
    
    // Test name pattern
    const namePattern = /(?:i'm|i am|my name is|call me|i go by)\s+([a-zA-Z\s]+)/i;
    const nameMatch = testMessage.match(namePattern);
    console.log('Name pattern test:', nameMatch);
    
    // Test kids pattern
    const kidsPattern = /(?:i have|i've got|i got)\s+(\d+)\s+(?:kids?|children)/i;
    const kidsMatch = testMessage.match(kidsPattern);
    console.log('Kids pattern test:', kidsMatch);
    
    return nuggets;
  }

  // Store memory nuggets in database
  async storeMemoryNuggets(nuggets: MemoryNugget[]): Promise<void> {
    if (nuggets.length === 0) {
      console.log('No memory nuggets to store');
      return;
    }

    console.log('Storing memory nuggets:', nuggets);

    try {
      const insertData = nuggets.map(nugget => ({
        id: nugget.id,
        user_id: nugget.userId,
        model_name: nugget.modelName,
        content: nugget.content,
        type: nugget.type,
        category: nugget.category || 'general', // Provide default category
        clarity: nugget.clarity,
        created_at: nugget.createdAt.toISOString(),
        last_accessed: nugget.lastAccessed.toISOString(),
        tags: nugget.tags,
      }));
      
      console.log('Insert data prepared:', insertData);
      
      const { data, error } = await supabase
        .from('memory_nuggets')
        .insert(insertData);

      if (error) {
        console.error('Error storing memory nuggets:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else {
        console.log('Successfully stored memory nuggets:', data);
      }
    } catch (error) {
      console.error('Error storing memory nuggets:', error);
    }
  }

  // Get memory context for a user and model
  async getMemoryContext(userId: string, modelName: string): Promise<MemoryContext> {
    try {
      console.log('Getting memory context for:', { userId, modelName });
      
      // First, let's test if the table exists and we can query it
      const { data, error } = await supabase
        .from('memory_nuggets')
        .select('*')
        .eq('user_id', userId)
        .eq('model_name', modelName)
        .order('last_accessed', { ascending: false });

      if (error) {
        console.error('Error fetching memory context:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return { anchors: [], triggers: [], recentMemories: [] };
      }

      console.log('Raw memory data from database:', data);
      const memories = data?.map(this.mapDbToMemoryNugget) || [];
      console.log('Mapped memories:', memories);
      
      const context = {
        anchors: memories.filter(m => m.type === 'anchor'),
        triggers: memories.filter(m => m.type === 'trigger' && m.clarity > 20), // Only clear triggers
        recentMemories: memories.slice(0, 10) // Last 10 accessed
      };
      
      console.log('Memory context retrieved:', context);
      return context;
    } catch (error) {
      console.error('Error fetching memory context:', error);
      return { anchors: [], triggers: [], recentMemories: [] };
    }
  }

  // Update memory clarity (intelligent forgetting for triggers)
  async updateMemoryClarity(): Promise<void> {
    try {
      const { data: triggers, error } = await supabase
        .from('memory_nuggets')
        .select('*')
        .eq('type', 'trigger');

      if (error) {
        console.error('Error fetching triggers for clarity update:', error);
        return;
      }

      const now = new Date();
      const updates = triggers?.map(trigger => {
        const created = new Date(trigger.created_at);
        const daysSinceCreation = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        
        let newClarity = trigger.clarity;
        
        // Apply decay rules
        if (daysSinceCreation >= 120) {
          newClarity = 0; // Delete
        } else if (daysSinceCreation >= 90) {
          newClarity = Math.max(0, newClarity - 20);
        } else if (daysSinceCreation >= 60) {
          newClarity = Math.max(0, newClarity - 20);
        } else if (daysSinceCreation >= 35) {
          newClarity = Math.max(0, newClarity - 10);
        } else if (daysSinceCreation >= 21) {
          newClarity = Math.max(0, newClarity - 10);
        } else if (daysSinceCreation >= 7) {
          newClarity = Math.max(0, newClarity - 10);
        } else {
          newClarity = Math.max(0, newClarity - 10); // End of session
        }

        return {
          id: trigger.id,
          clarity: newClarity,
          lastAccessed: now.toISOString()
        };
      }) || [];

      // Update or delete memories
      for (const update of updates) {
        if (update.clarity <= 0) {
          // Delete completely forgotten memories
          await supabase
            .from('memory_nuggets')
            .delete()
            .eq('id', update.id);
        } else {
          // Update clarity
          await supabase
            .from('memory_nuggets')
            .update({ 
              clarity: update.clarity,
              last_accessed: update.lastAccessed
            })
            .eq('id', update.id);
        }
      }
    } catch (error) {
      console.error('Error updating memory clarity:', error);
    }
  }

  // Generate memory-enhanced prompt for AI
  generateMemoryPrompt(memoryContext: MemoryContext, modelName: string): string {
    let memoryPrompt = '';
    
    if (memoryContext.anchors.length > 0) {
      memoryPrompt += `\n\nIMPORTANT USER ANCHORS (permanent facts about this user):\n`;
      memoryContext.anchors.forEach(anchor => {
        memoryPrompt += `- ${anchor.content}\n`;
      });
    }

    if (memoryContext.triggers.length > 0) {
      memoryPrompt += `\n\nCURRENT USER CONTEXT (recent/situational info):\n`;
      memoryContext.triggers.forEach(trigger => {
        const clarity = trigger.clarity;
        const certainty = clarity > 80 ? '' : clarity > 60 ? ' (I think)' : ' (I believe)';
        memoryPrompt += `- ${trigger.content}${certainty}\n`;
      });
    }

    if (memoryContext.recentMemories.length > 0) {
      memoryPrompt += `\n\nRECENT CONVERSATION HISTORY:\n`;
      memoryContext.recentMemories.slice(0, 5).forEach(memory => {
        memoryPrompt += `- ${memory.content}\n`;
      });
    }

    if (memoryPrompt) {
      memoryPrompt += `\nUse this information to make the conversation more personal, consistent, and emotionally rich. Reference these details naturally when appropriate. Never mention the memory system itself.`;
    }

    return memoryPrompt;
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();
    
    // Extract key words for tagging
    const keywords = ['work', 'job', 'family', 'friend', 'love', 'like', 'feel', 'stressed', 'excited', 'sick', 'tired', 'birthday', 'interview'];
    keywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        tags.push(keyword);
      }
    });
    
    return tags;
  }

  private mapDbToMemoryNugget(dbRecord: any): MemoryNugget {
    return {
      id: dbRecord.id,
      userId: dbRecord.user_id,
      modelName: dbRecord.model_name,
      content: dbRecord.content,
      type: dbRecord.type,
      category: dbRecord.category,
      clarity: dbRecord.clarity,
      createdAt: new Date(dbRecord.created_at),
      lastAccessed: new Date(dbRecord.last_accessed),
      tags: dbRecord.tags || []
    };
  }
}

export const memoryService = MemoryService.getInstance();
