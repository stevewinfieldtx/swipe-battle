-- Create user_tokens table for tracking token balances
CREATE TABLE IF NOT EXISTS user_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);

-- Enable Row Level Security
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own tokens" ON user_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON user_tokens;
DROP POLICY IF EXISTS "Service role can manage all tokens" ON user_tokens;

-- Users can view their own token balance
CREATE POLICY "Users can view their own tokens" ON user_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own token balance (for spending)
CREATE POLICY "Users can update their own tokens" ON user_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can manage all tokens (for purchases via webhook)
CREATE POLICY "Service role can manage all tokens" ON user_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- Function to automatically create token record for new users
CREATE OR REPLACE FUNCTION create_user_tokens()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_tokens (user_id, balance, total_purchased, total_spent)
  VALUES (NEW.id, 0, 0, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create token record when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_tokens();

-- Create token transaction log table
CREATE TABLE IF NOT EXISTS token_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'spend', 'refund')),
  amount INTEGER NOT NULL,
  description TEXT,
  payment_id TEXT, -- PayPal payment ID for purchases
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for transaction history
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at);

-- Enable RLS for transactions
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transaction history
CREATE POLICY "Users can view their own transactions" ON token_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all transactions
CREATE POLICY "Service role can manage all transactions" ON token_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- Function to add tokens to user balance (called from webhook)
CREATE OR REPLACE FUNCTION add_user_tokens(
  user_id UUID,
  tokens_to_add INTEGER,
  payment_id TEXT,
  payment_amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  -- Insert or update user tokens
  INSERT INTO user_tokens (user_id, balance, total_purchased)
  VALUES (user_id, tokens_to_add, tokens_to_add)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance = user_tokens.balance + tokens_to_add,
    total_purchased = user_tokens.total_purchased + tokens_to_add,
    updated_at = NOW();

  -- Log the transaction
  INSERT INTO token_transactions (user_id, transaction_type, amount, description, payment_id)
  VALUES (user_id, 'purchase', tokens_to_add, 
          'Token purchase via PayPal - $' || payment_amount::TEXT, payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to spend tokens (for photos/chat)
CREATE OR REPLACE FUNCTION spend_user_tokens(
  user_id UUID,
  tokens_to_spend INTEGER,
  description TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Get current balance
  SELECT balance INTO current_balance 
  FROM user_tokens 
  WHERE user_tokens.user_id = spend_user_tokens.user_id;

  -- Check if user has enough tokens
  IF current_balance IS NULL OR current_balance < tokens_to_spend THEN
    RETURN FALSE;
  END IF;

  -- Deduct tokens
  UPDATE user_tokens 
  SET 
    balance = balance - tokens_to_spend,
    total_spent = total_spent + tokens_to_spend,
    updated_at = NOW()
  WHERE user_tokens.user_id = spend_user_tokens.user_id;

  -- Log the transaction
  INSERT INTO token_transactions (user_id, transaction_type, amount, description)
  VALUES (user_id, 'spend', tokens_to_spend, description);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
