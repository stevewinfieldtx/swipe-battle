-- Create session_states table for tracking model's current state during conversation
CREATE TABLE IF NOT EXISTS session_states (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  current_activity TEXT DEFAULT 'chatting with you',
  clothing JSONB DEFAULT '{
    "top": "comfortable casual top",
    "bottom": "comfortable casual bottom",
    "underwear": "matching set",
    "accessories": [],
    "shoes": "none (barefoot or socks)"
  }',
  hair_style TEXT DEFAULT 'natural and styled',
  makeup TEXT DEFAULT 'light and natural',
  mood TEXT DEFAULT 'happy and engaged',
  energy TEXT DEFAULT 'medium' CHECK (energy IN ('low', 'medium', 'high')),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spatial_memories table for tracking model's body positioning
CREATE TABLE IF NOT EXISTS spatial_memories (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  body_position JSONB DEFAULT '{
    "wholeBody": "sitting comfortably",
    "leftFoot": "on the floor",
    "rightFoot": "on the floor",
    "leftHand": "resting naturally",
    "rightHand": "resting naturally",
    "head": "turned toward you",
    "torso": "relaxed and upright"
  }',
  proximity JSONB DEFAULT '{
    "distanceToUser": "medium",
    "touching": [],
    "facing": "toward"
  }',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_session_states_user_model_session ON session_states(user_id, model_name, session_id);
CREATE INDEX IF NOT EXISTS idx_spatial_memories_user_model_session ON spatial_memories(user_id, model_name, session_id);
CREATE INDEX IF NOT EXISTS idx_session_states_last_updated ON session_states(last_updated);
CREATE INDEX IF NOT EXISTS idx_spatial_memories_last_updated ON spatial_memories(last_updated);

-- Enable Row Level Security
ALTER TABLE session_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE spatial_memories ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can manage their own session states" ON session_states;
CREATE POLICY "Users can manage their own session states" ON session_states 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own spatial memories" ON spatial_memories;
CREATE POLICY "Users can manage their own spatial memories" ON spatial_memories 
  USING (auth.uid() = user_id);

-- Function to clean up old session data (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_session_data()
RETURNS void AS $$
BEGIN
  -- Delete session data older than 24 hours
  DELETE FROM session_states 
  WHERE last_updated < NOW() - INTERVAL '24 hours';
  
  DELETE FROM spatial_memories 
  WHERE last_updated < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_old_session_data() TO authenticated;

