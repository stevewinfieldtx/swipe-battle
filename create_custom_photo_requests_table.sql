-- Create custom_photo_requests table for tracking image generation requests
CREATE TABLE IF NOT EXISTS custom_photo_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  model_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  photo_type VARCHAR(20) NOT NULL CHECK (photo_type IN ('sfw', 'bikini', 'lingerie', 'topless', 'nude')),
  prompt TEXT NOT NULL,
  enhanced_prompt TEXT,
  image_url TEXT,
  token_cost INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_custom_photo_requests_user_id ON custom_photo_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_photo_requests_status ON custom_photo_requests(status);
CREATE INDEX IF NOT EXISTS idx_custom_photo_requests_created_at ON custom_photo_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_custom_photo_requests_model_name ON custom_photo_requests(model_name);

-- Enable Row Level Security
ALTER TABLE custom_photo_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own requests" ON custom_photo_requests;
DROP POLICY IF EXISTS "Users can insert their own requests" ON custom_photo_requests;
DROP POLICY IF EXISTS "Service role can manage all requests" ON custom_photo_requests;

-- Users can view their own requests
CREATE POLICY "Users can view their own requests" ON custom_photo_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can insert their own requests" ON custom_photo_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can manage all requests (for Edge Functions)
CREATE POLICY "Service role can manage all requests" ON custom_photo_requests
  FOR ALL USING (auth.role() = 'service_role');

-- Function to submit a custom photo request
CREATE OR REPLACE FUNCTION submit_custom_photo_request(
  p_user_id UUID,
  p_model_name TEXT,
  p_user_email TEXT,
  p_photo_type TEXT,
  p_prompt TEXT,
  p_token_cost INTEGER
)
RETURNS BIGINT AS $$
DECLARE
  request_id BIGINT;
  current_balance INTEGER;
BEGIN
  -- Check if user has enough tokens
  SELECT balance INTO current_balance 
  FROM user_tokens 
  WHERE user_id = p_user_id;

  IF current_balance IS NULL OR current_balance < p_token_cost THEN
    RAISE EXCEPTION 'Insufficient tokens. Required: %, Available: %', p_token_cost, COALESCE(current_balance, 0);
  END IF;

  -- Deduct tokens
  UPDATE user_tokens 
  SET 
    balance = balance - p_token_cost,
    total_spent = total_spent + p_token_cost,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log the transaction
  INSERT INTO token_transactions (user_id, transaction_type, amount, description)
  VALUES (p_user_id, 'spend', p_token_cost, 'Custom photo request: ' || p_photo_type || ' - ' || p_model_name);

  -- Insert the request
  INSERT INTO custom_photo_requests (
    user_id, model_name, user_email, photo_type, prompt, token_cost, status
  ) VALUES (
    p_user_id, p_model_name, p_user_email, p_photo_type, p_prompt, p_token_cost, 'pending'
  ) RETURNING id INTO request_id;

  RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
