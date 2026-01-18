/*
  # Fix Image Credits Calculation to Include Event Credits

  1. Changes
    - Update `get_user_credit_balance` function to include event_credits in image_credits total
    - Event passes include image credits that should be usable for AI image generation

  2. Previous Behavior
    - image_credits = subscription_credits + purchased_credits (missing event_credits)
    - Event credits were only counted in total_credits but not usable for images

  3. New Behavior
    - image_credits = subscription_credits + purchased_credits + event_credits
    - All credit sources contribute to image generation capability

  4. Rationale
    - Event passes include image credits (e.g., Starter Event: 100 credits)
    - These credits should be immediately usable for image generation
    - Aligns with pricing structure documentation
*/

-- Drop and recreate function with correct calculation
DROP FUNCTION IF EXISTS get_user_credit_balance(uuid);

CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id uuid)
RETURNS TABLE (
  subscription_credits integer,
  purchased_credits integer,
  event_credits integer,
  image_credits integer,
  total_credits integer,
  subscription_sms_credits integer,
  purchased_sms_credits integer,
  event_sms_credits integer,
  total_sms_credits integer
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_subscription_credits integer;
  v_purchased_credits integer;
  v_event_credits integer;
  v_subscription_sms_credits integer;
  v_purchased_sms_credits integer;
  v_event_sms_credits integer;
BEGIN
  -- Fetch credit data
  SELECT
    COALESCE(user_credits.subscription_credits, 0),
    COALESCE(user_credits.purchased_credits, 0),
    COALESCE(user_credits.event_credits, 0),
    COALESCE(user_credits.subscription_sms_credits, 0),
    COALESCE(user_credits.purchased_sms_credits, 0),
    COALESCE(user_credits.event_sms_credits, 0)
  INTO
    v_subscription_credits,
    v_purchased_credits,
    v_event_credits,
    v_subscription_sms_credits,
    v_purchased_sms_credits,
    v_event_sms_credits
  FROM user_credits
  WHERE user_credits.user_id = p_user_id;

  -- If no record found, return zeros
  IF NOT FOUND THEN
    v_subscription_credits := 0;
    v_purchased_credits := 0;
    v_event_credits := 0;
    v_subscription_sms_credits := 0;
    v_purchased_sms_credits := 0;
    v_event_sms_credits := 0;
  END IF;

  -- Return the data with event_credits included in image_credits
  RETURN QUERY SELECT
    v_subscription_credits,
    v_purchased_credits,
    v_event_credits,
    v_subscription_credits + v_purchased_credits + v_event_credits AS image_credits,
    v_subscription_credits + v_purchased_credits + v_event_credits AS total_credits,
    v_subscription_sms_credits,
    v_purchased_sms_credits,
    v_event_sms_credits,
    v_subscription_sms_credits + v_purchased_sms_credits + v_event_sms_credits AS total_sms_credits;
END;
$$;

-- Grant execute to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION get_user_credit_balance(uuid) TO anon, authenticated;
