/*
  # Create Credit Ledger System
  
  1. New Tables
    - `credit_ledger`
      - Logs all credit transactions (purchases, consumption, grants)
      - Tracks source (subscription, credit_pack, event, admin_grant)
      - Links to Stripe sessions for audit trail
    
  2. Changes to Existing Tables
    - `user_credits`
      - Add `subscription_credits` - credits from active subscription
      - Add `purchased_credits` - credits from one-time credit pack purchases
      - Add `event_credits` - credits from event passes
      - Keep `images_limit` and `images_used` for backward compatibility
    
    - `credit_topup_products`
      - Add unique constraint on name
  
  3. New Credit Topup Products
    - Insert the 4 authorized credit packs
    - Small Boost (100 credits)
    - Creator Pack (300 credits)
    - Pro Boost (750 credits)
    - Power Pack (1500 credits)
  
  4. Security
    - Enable RLS on credit_ledger
    - Users can view their own ledger entries
    - Admins can view all entries
*/

-- Create credit_ledger table
CREATE TABLE IF NOT EXISTS credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('subscription', 'credit_pack', 'event', 'admin_grant', 'consumption')),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  stripe_session_id text,
  stripe_payment_intent_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add new credit columns to user_credits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'subscription_credits'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN subscription_credits integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'purchased_credits'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN purchased_credits integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'event_credits'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN event_credits integer DEFAULT 0;
  END IF;
END $$;

-- Add unique constraint to credit_topup_products name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'credit_topup_products_name_key'
  ) THEN
    ALTER TABLE credit_topup_products ADD CONSTRAINT credit_topup_products_name_key UNIQUE (name);
  END IF;
END $$;

-- Enable RLS on credit_ledger
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_ledger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_ledger' AND policyname = 'Users can view own credit ledger'
  ) THEN
    CREATE POLICY "Users can view own credit ledger"
      ON credit_ledger FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_ledger' AND policyname = 'Admins can view all credit ledgers'
  ) THEN
    CREATE POLICY "Admins can view all credit ledgers"
      ON credit_ledger FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND LOWER(user_profiles.role) = 'admin'
        )
      );
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created_at ON credit_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_source ON credit_ledger(source);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_stripe_session ON credit_ledger(stripe_session_id);

-- Delete any old/invalid credit packs
DELETE FROM credit_topup_products 
WHERE name NOT IN ('Small Boost', 'Creator Pack', 'Pro Boost', 'Power Pack');

-- Insert the 4 authorized credit topup products (price will be read from Stripe)
INSERT INTO credit_topup_products (name, credits, price_cents, display_order, is_active) VALUES
('Small Boost', 100, 0, 1, true),
('Creator Pack', 300, 0, 2, true),
('Pro Boost', 750, 0, 3, true),
('Power Pack', 1500, 0, 4, true)
ON CONFLICT (name) DO UPDATE SET
  credits = EXCLUDED.credits,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- Create function to get total available credits
CREATE OR REPLACE FUNCTION get_total_credits(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_credits integer;
  v_purchased_credits integer;
  v_event_credits integer;
BEGIN
  SELECT 
    COALESCE(subscription_credits, 0),
    COALESCE(purchased_credits, 0),
    COALESCE(event_credits, 0)
  INTO v_subscription_credits, v_purchased_credits, v_event_credits
  FROM user_credits
  WHERE user_id = p_user_id;
  
  RETURN v_subscription_credits + v_purchased_credits + v_event_credits;
END;
$$;

-- Create function to consume credits (subscription → purchased → event)
CREATE OR REPLACE FUNCTION consume_credit(p_user_id uuid, p_amount integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_credits integer;
  v_purchased_credits integer;
  v_event_credits integer;
  v_total_credits integer;
  v_consumed_from text;
  v_balance_after integer;
BEGIN
  -- Lock the row for update
  SELECT 
    COALESCE(subscription_credits, 0),
    COALESCE(purchased_credits, 0),
    COALESCE(event_credits, 0)
  INTO v_subscription_credits, v_purchased_credits, v_event_credits
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  v_total_credits := v_subscription_credits + v_purchased_credits + v_event_credits;
  
  IF v_total_credits < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'available', v_total_credits
    );
  END IF;
  
  -- Consume from subscription first
  IF v_subscription_credits >= p_amount THEN
    UPDATE user_credits
    SET subscription_credits = subscription_credits - p_amount,
        images_used = images_used + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    v_consumed_from := 'subscription';
    v_balance_after := v_total_credits - p_amount;
  
  -- Then from purchased credits
  ELSIF v_subscription_credits + v_purchased_credits >= p_amount THEN
    DECLARE
      v_remaining integer := p_amount - v_subscription_credits;
    BEGIN
      UPDATE user_credits
      SET subscription_credits = 0,
          purchased_credits = purchased_credits - v_remaining,
          images_used = images_used + p_amount,
          updated_at = now()
      WHERE user_id = p_user_id;
      
      v_consumed_from := 'purchased';
      v_balance_after := v_total_credits - p_amount;
    END;
  
  -- Finally from event credits
  ELSE
    DECLARE
      v_remaining integer := p_amount - v_subscription_credits - v_purchased_credits;
    BEGIN
      UPDATE user_credits
      SET subscription_credits = 0,
          purchased_credits = 0,
          event_credits = event_credits - v_remaining,
          images_used = images_used + p_amount,
          updated_at = now()
      WHERE user_id = p_user_id;
      
      v_consumed_from := 'event';
      v_balance_after := v_total_credits - p_amount;
    END;
  END IF;
  
  -- Log to credit ledger
  INSERT INTO credit_ledger (user_id, source, amount, balance_after, metadata)
  VALUES (
    p_user_id,
    'consumption',
    -p_amount,
    v_balance_after,
    jsonb_build_object('consumed_from', v_consumed_from)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'consumed_from', v_consumed_from,
    'amount', p_amount,
    'balance_after', v_balance_after
  );
END;
$$;

-- Create function to add purchased credits
CREATE OR REPLACE FUNCTION add_purchased_credits(
  p_user_id uuid,
  p_credits integer,
  p_stripe_session_id text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_credits integer;
BEGIN
  -- Add credits to purchased_credits
  UPDATE user_credits
  SET purchased_credits = COALESCE(purchased_credits, 0) + p_credits,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Get new total balance
  SELECT get_total_credits(p_user_id) INTO v_total_credits;
  
  -- Log to credit ledger
  INSERT INTO credit_ledger (
    user_id,
    source,
    amount,
    balance_after,
    stripe_session_id,
    stripe_payment_intent_id,
    metadata
  )
  VALUES (
    p_user_id,
    'credit_pack',
    p_credits,
    v_total_credits,
    p_stripe_session_id,
    p_stripe_payment_intent_id,
    jsonb_build_object('expires', 'never')
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_added', p_credits,
    'new_balance', v_total_credits
  );
END;
$$;
