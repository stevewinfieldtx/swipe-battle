-- Create battles table for tracking model vs model competitions
CREATE TABLE IF NOT EXISTS battles (
  id BIGSERIAL PRIMARY KEY,
  winner_name TEXT NOT NULL,
  loser_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  bucket_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_battles_winner ON battles(winner_name);
CREATE INDEX IF NOT EXISTS idx_battles_loser ON battles(loser_name);
CREATE INDEX IF NOT EXISTS idx_battles_user ON battles(user_id);
CREATE INDEX IF NOT EXISTS idx_battles_created_at ON battles(created_at);

-- Enable Row Level Security
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to insert their own battles
CREATE POLICY "Users can insert their own battles" ON battles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to view all battles (for stats)
CREATE POLICY "Users can view all battles" ON battles
  FOR SELECT USING (true);

-- Create a view for model statistics
CREATE OR REPLACE VIEW model_stats AS
SELECT 
  winner_name as model_name,
  COUNT(*) as wins,
  (
    SELECT COUNT(*) 
    FROM battles b2 
    WHERE b2.loser_name = battles.winner_name
  ) as losses,
  ROUND(
    COUNT(*)::DECIMAL / 
    NULLIF(
      COUNT(*) + (
        SELECT COUNT(*) 
        FROM battles b3 
        WHERE b3.loser_name = battles.winner_name
      ), 
      0
    ) * 100, 
    1
  ) as win_percentage
FROM battles
GROUP BY winner_name
UNION
SELECT 
  loser_name as model_name,
  (
    SELECT COUNT(*) 
    FROM battles b4 
    WHERE b4.winner_name = battles.loser_name
  ) as wins,
  COUNT(*) as losses,
  ROUND(
    (
      SELECT COUNT(*) 
      FROM battles b5 
      WHERE b5.winner_name = battles.loser_name
    )::DECIMAL / 
    NULLIF(
      (
        SELECT COUNT(*) 
        FROM battles b6 
        WHERE b6.winner_name = battles.loser_name
      ) + COUNT(*), 
      0
    ) * 100, 
    1
  ) as win_percentage
FROM battles
GROUP BY loser_name;
