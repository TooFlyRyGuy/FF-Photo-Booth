/*
  # Fix consume_credit Function for New Credit Schema

  This migration updates the consume_credit function to work with the new credit structure:
  - subscription_credits (from active subscription)
  - purchased_credits (from credit packs)
  - event_credits (single event pass)

  1. Function Updates
    - `consume_credit` - Updated to consume credits in priority order:
      1. purchased_credits (use paid credits first)
      2. subscription_credits (then subscription credits)
    - Uses SECURITY DEFINER to bypass RLS (required for kiosk users)
    - Returns success boolean and which credit type was consumed from
  
  2. Credit Consumption Priority
    - Purchased credits are consumed first (paid credit packs)
    - Then subscription credits (monthly allowance)
    - Event credits are NOT consumed for image generation (only for event creation)
*/

-- Drop old function
DROP FUNCTION IF EXISTS consume_credit(uuid, integer);

-- Create new consume_credit function that works with new schema
CREATE OR REPLACE FUNCTION consume_credit(
  p_user_id uuid,
  p_amount integer DEFAULT 1
)
RETURNS TABLE (
  success boolean,
  consumed_from text
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  v_purchased_credits integer;
  v_subscription_credits integer;
  v_amount_remaining integer;
  v_consumed_from text := '';
BEGIN
  -- Get current credits
  SELECT 
    COALESCE(user_credits.purchased_credits, 0),
    COALESCE(user_credits.subscription_credits, 0)
  INTO v_purchased_credits, v_subscription_credits
  FROM user_credits
  WHERE user_credits.user_id = p_user_id;
  
  -- If no record found, create one with zero credits
  IF NOT FOUND THEN
    INSERT INTO user_credits (user_id, subscription_credits, purchased_credits, event_credits)
    VALUES (p_user_id, 0, 0, 0);
    
    RETURN QUERY SELECT false, 'insufficient_credits'::text;
    RETURN;
  END IF;
  
  -- Check if user has enough total credits
  IF (v_purchased_credits + v_subscription_credits) < p_amount THEN
    RETURN QUERY SELECT false, 'insufficient_credits'::text;
    RETURN;
  END IF;
  
  v_amount_remaining := p_amount;
  
  -- First, consume from purchased_credits
  IF v_purchased_credits > 0 THEN
    IF v_purchased_credits >= v_amount_remaining THEN
      -- All from purchased credits
      UPDATE user_credits
      SET purchased_credits = purchased_credits - v_amount_remaining
      WHERE user_id = p_user_id;
      
      v_consumed_from := 'purchased';
      RETURN QUERY SELECT true, v_consumed_from;
      RETURN;
    ELSE
      -- Consume all purchased credits and continue
      v_amount_remaining := v_amount_remaining - v_purchased_credits;
      
      UPDATE user_credits
      SET purchased_credits = 0
      WHERE user_id = p_user_id;
      
      v_consumed_from := 'purchased+subscription';
    END IF;
  END IF;
  
  -- Then consume from subscription_credits
  IF v_amount_remaining > 0 THEN
    UPDATE user_credits
    SET subscription_credits = subscription_credits - v_amount_remaining
    WHERE user_id = p_user_id;
    
    IF v_consumed_from = '' THEN
      v_consumed_from := 'subscription';
    END IF;
  END IF;
  
  RETURN QUERY SELECT true, v_consumed_from;
END;
$$;

-- Grant execute to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION consume_credit(uuid, integer) TO anon, authenticated;
