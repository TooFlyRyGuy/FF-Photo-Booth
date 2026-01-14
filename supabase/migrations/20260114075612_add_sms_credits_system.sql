/*
  # Add SMS Credits System

  1. Changes to Existing Tables
    - `user_credits`
      - Add `subscription_sms_credits` - SMS credits from active subscription
      - Add `purchased_sms_credits` - SMS credits from one-time credit pack purchases
      - Add `event_sms_credits` - SMS credits from event passes
      - Add `sms_used` - total SMS messages sent

    - `subscription_tiers`
      - Add `sms_credits_per_period` - SMS credits included per billing period

    - `credit_topup_products`
      - Add `sms_credits` - SMS credits included in top-up pack

    - `event_passes`
      - Add `sms_credits` - SMS credits included in event pass

    - `purchased_event_passes`
      - Add `sms_credits_allocated` - SMS credits allocated to this pass
      - Add `sms_credits_used` - SMS credits used from this pass

    - `credit_ledger`
      - Add `sms_amount` - SMS credits in transaction
      - Add `sms_balance_after` - SMS credit balance after transaction

  2. New Functions
    - `get_total_sms_credits(user_id)` - Returns total available SMS credits
    - `consume_sms_credit(user_id, amount)` - Consumes SMS credits (subscription → purchased → event)
    - `add_purchased_sms_credits(user_id, credits, session_id, payment_intent_id)` - Adds purchased SMS credits

  3. Security
    - No new tables, existing RLS policies apply

  4. Notes
    - SMS credits follow the same consumption order as image credits: subscription → purchased → event
    - Subscription SMS credits do NOT roll over on renewal
    - SMS credits are tracked separately from image credits
*/

-- Add SMS credit columns to user_credits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_credits' AND column_name = 'subscription_sms_credits'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN subscription_sms_credits integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_credits' AND column_name = 'purchased_sms_credits'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN purchased_sms_credits integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_credits' AND column_name = 'event_sms_credits'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN event_sms_credits integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_credits' AND column_name = 'sms_used'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN sms_used integer DEFAULT 0;
  END IF;
END $$;

-- Add SMS credits to subscription_tiers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'sms_credits_per_period'
  ) THEN
    ALTER TABLE subscription_tiers ADD COLUMN sms_credits_per_period integer DEFAULT 0;
  END IF;
END $$;

-- Add SMS credits to credit_topup_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_topup_products' AND column_name = 'sms_credits'
  ) THEN
    ALTER TABLE credit_topup_products ADD COLUMN sms_credits integer DEFAULT 0;
  END IF;
END $$;

-- Add SMS credits to event_passes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_passes' AND column_name = 'sms_credits'
  ) THEN
    ALTER TABLE event_passes ADD COLUMN sms_credits integer DEFAULT 0;
  END IF;
END $$;

-- Add SMS credits to purchased_event_passes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchased_event_passes' AND column_name = 'sms_credits_allocated'
  ) THEN
    ALTER TABLE purchased_event_passes ADD COLUMN sms_credits_allocated integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchased_event_passes' AND column_name = 'sms_credits_used'
  ) THEN
    ALTER TABLE purchased_event_passes ADD COLUMN sms_credits_used integer DEFAULT 0;
  END IF;
END $$;

-- Add SMS credit tracking to credit_ledger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_ledger' AND column_name = 'sms_amount'
  ) THEN
    ALTER TABLE credit_ledger ADD COLUMN sms_amount integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_ledger' AND column_name = 'sms_balance_after'
  ) THEN
    ALTER TABLE credit_ledger ADD COLUMN sms_balance_after integer DEFAULT 0;
  END IF;
END $$;

-- Create function to get total available SMS credits
CREATE OR REPLACE FUNCTION get_total_sms_credits(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_sms_credits integer;
  v_purchased_sms_credits integer;
  v_event_sms_credits integer;
BEGIN
  SELECT
    COALESCE(subscription_sms_credits, 0),
    COALESCE(purchased_sms_credits, 0),
    COALESCE(event_sms_credits, 0)
  INTO v_subscription_sms_credits, v_purchased_sms_credits, v_event_sms_credits
  FROM user_credits
  WHERE user_id = p_user_id;

  RETURN v_subscription_sms_credits + v_purchased_sms_credits + v_event_sms_credits;
END;
$$;

-- Create function to consume SMS credits (subscription → purchased → event)
CREATE OR REPLACE FUNCTION consume_sms_credit(p_user_id uuid, p_amount integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_sms_credits integer;
  v_purchased_sms_credits integer;
  v_event_sms_credits integer;
  v_total_sms_credits integer;
  v_consumed_from text;
  v_balance_after integer;
BEGIN
  -- Lock the row for update
  SELECT
    COALESCE(subscription_sms_credits, 0),
    COALESCE(purchased_sms_credits, 0),
    COALESCE(event_sms_credits, 0)
  INTO v_subscription_sms_credits, v_purchased_sms_credits, v_event_sms_credits
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_total_sms_credits := v_subscription_sms_credits + v_purchased_sms_credits + v_event_sms_credits;

  IF v_total_sms_credits < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient SMS credits',
      'available', v_total_sms_credits
    );
  END IF;

  -- Consume from subscription first
  IF v_subscription_sms_credits >= p_amount THEN
    UPDATE user_credits
    SET subscription_sms_credits = subscription_sms_credits - p_amount,
        sms_used = sms_used + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

    v_consumed_from := 'subscription';
    v_balance_after := v_total_sms_credits - p_amount;

  -- Then from purchased credits
  ELSIF v_subscription_sms_credits + v_purchased_sms_credits >= p_amount THEN
    DECLARE
      v_remaining integer := p_amount - v_subscription_sms_credits;
    BEGIN
      UPDATE user_credits
      SET subscription_sms_credits = 0,
          purchased_sms_credits = purchased_sms_credits - v_remaining,
          sms_used = sms_used + p_amount,
          updated_at = now()
      WHERE user_id = p_user_id;

      v_consumed_from := 'purchased';
      v_balance_after := v_total_sms_credits - p_amount;
    END;

  -- Finally from event credits
  ELSE
    DECLARE
      v_remaining integer := p_amount - v_subscription_sms_credits - v_purchased_sms_credits;
    BEGIN
      UPDATE user_credits
      SET subscription_sms_credits = 0,
          purchased_sms_credits = 0,
          event_sms_credits = event_sms_credits - v_remaining,
          sms_used = sms_used + p_amount,
          updated_at = now()
      WHERE user_id = p_user_id;

      v_consumed_from := 'event';
      v_balance_after := v_total_sms_credits - p_amount;
    END;
  END IF;

  -- Log to credit ledger
  INSERT INTO credit_ledger (user_id, source, amount, balance_after, sms_amount, sms_balance_after, metadata)
  VALUES (
    p_user_id,
    'consumption',
    0, -- No image credits consumed
    (SELECT COALESCE(subscription_credits, 0) + COALESCE(purchased_credits, 0) + COALESCE(event_credits, 0) FROM user_credits WHERE user_id = p_user_id),
    -p_amount,
    v_balance_after,
    jsonb_build_object('consumed_from', v_consumed_from, 'type', 'sms')
  );

  RETURN jsonb_build_object(
    'success', true,
    'consumed_from', v_consumed_from,
    'amount', p_amount,
    'balance_after', v_balance_after
  );
END;
$$;

-- Create function to add purchased SMS credits
CREATE OR REPLACE FUNCTION add_purchased_sms_credits(
  p_user_id uuid,
  p_sms_credits integer,
  p_stripe_session_id text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sms_credits integer;
BEGIN
  -- Add SMS credits to purchased_sms_credits
  UPDATE user_credits
  SET purchased_sms_credits = COALESCE(purchased_sms_credits, 0) + p_sms_credits,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Get new total SMS balance
  SELECT get_total_sms_credits(p_user_id) INTO v_total_sms_credits;

  -- Log to credit ledger
  INSERT INTO credit_ledger (
    user_id,
    source,
    amount,
    balance_after,
    sms_amount,
    sms_balance_after,
    stripe_session_id,
    stripe_payment_intent_id,
    metadata
  )
  VALUES (
    p_user_id,
    'credit_pack',
    0, -- No image credits
    (SELECT COALESCE(subscription_credits, 0) + COALESCE(purchased_credits, 0) + COALESCE(event_credits, 0) FROM user_credits WHERE user_id = p_user_id),
    p_sms_credits,
    v_total_sms_credits,
    p_stripe_session_id,
    p_stripe_payment_intent_id,
    jsonb_build_object('expires', 'never', 'type', 'sms')
  );

  RETURN jsonb_build_object(
    'success', true,
    'sms_credits_added', p_sms_credits,
    'new_sms_balance', v_total_sms_credits
  );
END;
$$;

-- Create indexes for SMS credit queries
CREATE INDEX IF NOT EXISTS idx_user_credits_subscription_sms_credits ON user_credits(subscription_sms_credits);
CREATE INDEX IF NOT EXISTS idx_user_credits_purchased_sms_credits ON user_credits(purchased_sms_credits);
CREATE INDEX IF NOT EXISTS idx_user_credits_event_sms_credits ON user_credits(event_sms_credits);
