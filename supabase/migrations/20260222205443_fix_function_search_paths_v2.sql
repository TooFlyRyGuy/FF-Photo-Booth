/*
  # Fix Function Search Paths to be Immutable

  ## Overview
  This migration fixes database functions that have role-mutable search paths, which is a security risk.
  Functions with mutable search paths can be exploited through search_path manipulation attacks.
  We drop and recreate functions with explicit search_path set to 'public, pg_temp'.

  ## Changes Made
  
  Sets search_path to 'public, pg_temp' for all affected functions:
  - update_webhook_events_updated_at
  - get_user_image_credits
  - get_user_event_credits
  - consume_credit
  - get_total_sms_credits
  - consume_sms_credit
  - add_purchased_sms_credits
  - is_prompt_owner
  - get_user_credit_balance
  - add_purchased_credits
  - get_total_credits
  
  ## Security Impact
  This prevents potential SQL injection and privilege escalation attacks that could occur
  through search_path manipulation.
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS update_webhook_events_updated_at() CASCADE;
DROP FUNCTION IF EXISTS get_user_image_credits(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_user_event_credits(uuid) CASCADE;
DROP FUNCTION IF EXISTS consume_credit(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS get_total_sms_credits(uuid) CASCADE;
DROP FUNCTION IF EXISTS consume_sms_credit(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS add_purchased_sms_credits(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS is_prompt_owner(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS get_user_credit_balance(uuid) CASCADE;
DROP FUNCTION IF EXISTS add_purchased_credits(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS get_total_credits(uuid) CASCADE;

-- Recreate with immutable search paths

CREATE FUNCTION update_webhook_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION get_user_image_credits(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  total_credits integer;
BEGIN
  SELECT COALESCE(
    subscription_credits +
    purchased_credits +
    event_credits,
    0
  ) INTO total_credits
  FROM user_credits
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(total_credits, 0);
END;
$$;

CREATE FUNCTION get_user_event_credits(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  event_credits_balance integer;
BEGIN
  SELECT COALESCE(event_credits, 0) INTO event_credits_balance
  FROM user_credits
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(event_credits_balance, 0);
END;
$$;

CREATE FUNCTION consume_credit(
  p_user_id uuid,
  p_amount integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_subscription_credits integer;
  current_purchased_credits integer;
  current_event_credits integer;
  remaining integer;
BEGIN
  SELECT 
    COALESCE(subscription_credits, 0),
    COALESCE(purchased_credits, 0),
    COALESCE(event_credits, 0)
  INTO 
    current_subscription_credits,
    current_purchased_credits,
    current_event_credits
  FROM user_credits
  WHERE user_id = p_user_id;

  remaining := p_amount;

  IF current_event_credits > 0 THEN
    IF current_event_credits >= remaining THEN
      UPDATE user_credits
      SET event_credits = event_credits - remaining
      WHERE user_id = p_user_id;
      RETURN true;
    ELSE
      remaining := remaining - current_event_credits;
      UPDATE user_credits
      SET event_credits = 0
      WHERE user_id = p_user_id;
    END IF;
  END IF;

  IF remaining > 0 AND current_subscription_credits > 0 THEN
    IF current_subscription_credits >= remaining THEN
      UPDATE user_credits
      SET subscription_credits = subscription_credits - remaining
      WHERE user_id = p_user_id;
      RETURN true;
    ELSE
      remaining := remaining - current_subscription_credits;
      UPDATE user_credits
      SET subscription_credits = 0
      WHERE user_id = p_user_id;
    END IF;
  END IF;

  IF remaining > 0 AND current_purchased_credits > 0 THEN
    IF current_purchased_credits >= remaining THEN
      UPDATE user_credits
      SET purchased_credits = purchased_credits - remaining
      WHERE user_id = p_user_id;
      RETURN true;
    ELSE
      RETURN false;
    END IF;
  END IF;

  IF remaining > 0 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE FUNCTION get_total_sms_credits(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  total_sms integer;
BEGIN
  SELECT COALESCE(
    subscription_sms_credits +
    purchased_sms_credits +
    event_sms_credits,
    0
  ) INTO total_sms
  FROM user_credits
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(total_sms, 0);
END;
$$;

CREATE FUNCTION consume_sms_credit(
  p_user_id uuid,
  p_amount integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_subscription_sms integer;
  current_purchased_sms integer;
  current_event_sms integer;
  remaining integer;
BEGIN
  SELECT 
    COALESCE(subscription_sms_credits, 0),
    COALESCE(purchased_sms_credits, 0),
    COALESCE(event_sms_credits, 0)
  INTO 
    current_subscription_sms,
    current_purchased_sms,
    current_event_sms
  FROM user_credits
  WHERE user_id = p_user_id;

  remaining := p_amount;

  IF current_event_sms > 0 THEN
    IF current_event_sms >= remaining THEN
      UPDATE user_credits
      SET event_sms_credits = event_sms_credits - remaining
      WHERE user_id = p_user_id;
      RETURN true;
    ELSE
      remaining := remaining - current_event_sms;
      UPDATE user_credits
      SET event_sms_credits = 0
      WHERE user_id = p_user_id;
    END IF;
  END IF;

  IF remaining > 0 AND current_subscription_sms > 0 THEN
    IF current_subscription_sms >= remaining THEN
      UPDATE user_credits
      SET subscription_sms_credits = subscription_sms_credits - remaining
      WHERE user_id = p_user_id;
      RETURN true;
    ELSE
      remaining := remaining - current_subscription_sms;
      UPDATE user_credits
      SET subscription_sms_credits = 0
      WHERE user_id = p_user_id;
    END IF;
  END IF;

  IF remaining > 0 AND current_purchased_sms > 0 THEN
    IF current_purchased_sms >= remaining THEN
      UPDATE user_credits
      SET purchased_sms_credits = purchased_sms_credits - remaining
      WHERE user_id = p_user_id;
      RETURN true;
    ELSE
      RETURN false;
    END IF;
  END IF;

  IF remaining > 0 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE FUNCTION add_purchased_sms_credits(
  p_user_id uuid,
  p_amount integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO user_credits (user_id, purchased_sms_credits)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET
    purchased_sms_credits = user_credits.purchased_sms_credits + p_amount;
END;
$$;

CREATE FUNCTION is_prompt_owner(p_prompt_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  prompt_user_id uuid;
BEGIN
  SELECT user_id INTO prompt_user_id
  FROM prompts
  WHERE id = p_prompt_id;
  
  RETURN prompt_user_id = p_user_id;
END;
$$;

CREATE FUNCTION get_user_credit_balance(p_user_id uuid)
RETURNS TABLE(
  subscription_credits integer,
  purchased_credits integer,
  event_credits integer,
  total_credits integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(uc.subscription_credits, 0)::integer,
    COALESCE(uc.purchased_credits, 0)::integer,
    COALESCE(uc.event_credits, 0)::integer,
    COALESCE(
      uc.subscription_credits + 
      uc.purchased_credits + 
      uc.event_credits,
      0
    )::integer
  FROM user_credits uc
  WHERE uc.user_id = p_user_id;
END;
$$;

CREATE FUNCTION add_purchased_credits(
  p_user_id uuid,
  p_amount integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO user_credits (user_id, purchased_credits)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET
    purchased_credits = user_credits.purchased_credits + p_amount;
END;
$$;

CREATE FUNCTION get_total_credits(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  total integer;
BEGIN
  SELECT COALESCE(
    subscription_credits +
    purchased_credits +
    event_credits,
    0
  ) INTO total
  FROM user_credits
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(total, 0);
END;
$$;

-- Recreate trigger for webhook_events
DROP TRIGGER IF EXISTS set_webhook_events_updated_at ON webhook_events;

CREATE TRIGGER set_webhook_events_updated_at
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_events_updated_at();
