-- Create simple battles table
CREATE TABLE IF NOT EXISTS battles (
  id BIGSERIAL PRIMARY KEY,
  winner_name TEXT NOT NULL,
  loser_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_battles_winner ON battles(winner_name);
CREATE INDEX IF NOT EXISTS idx_battles_loser ON battles(loser_name);
CREATE INDEX IF NOT EXISTS idx_battles_user ON battles(user_id);

-- Enable Row Level Security
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can insert their own battles" ON battles;
DROP POLICY IF EXISTS "Users can view all battles" ON battles;

CREATE POLICY "Users can insert their own battles" ON battles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all battles" ON battles
  FOR SELECT USING (true);
