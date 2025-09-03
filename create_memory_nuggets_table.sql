-- Create memory_nuggets table for storing user personal information and conversation context
CREATE TABLE IF NOT EXISTS memory_nuggets (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('anchor', 'trigger')),
  category TEXT NOT NULL,
  clarity INTEGER DEFAULT 100 CHECK (clarity >= 0 AND clarity <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}'
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_memory_nuggets_user_model ON memory_nuggets(user_id, model_name);
CREATE INDEX IF NOT EXISTS idx_memory_nuggets_type ON memory_nuggets(type);
CREATE INDEX IF NOT EXISTS idx_memory_nuggets_category ON memory_nuggets(category);
CREATE INDEX IF NOT EXISTS idx_memory_nuggets_clarity ON memory_nuggets(clarity);
CREATE INDEX IF NOT EXISTS idx_memory_nuggets_last_accessed ON memory_nuggets(last_accessed);

-- Enable Row Level Security
ALTER TABLE memory_nuggets ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can manage their own memory nuggets" ON memory_nuggets;
CREATE POLICY "Users can manage their own memory nuggets" ON memory_nuggets 
  USING (auth.uid() = user_id);

-- Function to clean up old memory nuggets (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_memory_nuggets()
RETURNS void AS $$
BEGIN
  -- Delete memory nuggets with clarity 0 (completely forgotten)
  DELETE FROM memory_nuggets 
  WHERE clarity = 0;
  
  -- Delete very old trigger memories (older than 6 months)
  DELETE FROM memory_nuggets 
  WHERE type = 'trigger' 
  AND created_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_old_memory_nuggets() TO authenticated;