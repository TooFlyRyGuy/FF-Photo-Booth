/*
  # Allow Credit Checks for Kiosk Users

  This migration creates a secure function that allows anonymous kiosk users to check
  credit balances for event owners when generating photos.

  1. Security Functions
    - `get_user_credit_balance` - SECURITY DEFINER function that bypasses RLS to read credit balance
    - Used by kiosk mode to check if event owner has sufficient credits
    - Only returns credit balance data, no sensitive user information
  
  2. Security Notes
    - Function runs with elevated privileges (SECURITY DEFINER)
    - Only exposes credit balance information, not other user data
    - Required for anonymous kiosk users to check event owner's credits before generating images
*/

-- Create function to get user credit balance (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id uuid)
RETURNS TABLE (
  subscription_credits integer,
  purchased_credits integer,
  event_credits integer,
  image_credits integer,
  total_credits integer
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_subscription_credits integer;
  v_purchased_credits integer;
  v_event_credits integer;
BEGIN
  -- Fetch credit data
  SELECT 
    COALESCE(user_credits.subscription_credits, 0),
    COALESCE(user_credits.purchased_credits, 0),
    COALESCE(user_credits.event_credits, 0)
  INTO v_subscription_credits, v_purchased_credits, v_event_credits
  FROM user_credits
  WHERE user_credits.user_id = p_user_id;
  
  -- If no record found, return zeros
  IF NOT FOUND THEN
    v_subscription_credits := 0;
    v_purchased_credits := 0;
    v_event_credits := 0;
  END IF;
  
  -- Return the data
  RETURN QUERY SELECT 
    v_subscription_credits,
    v_purchased_credits,
    v_event_credits,
    v_subscription_credits + v_purchased_credits AS image_credits,
    v_subscription_credits + v_purchased_credits + v_event_credits AS total_credits;
END;
$$;

-- Grant execute to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION get_user_credit_balance(uuid) TO anon, authenticated;
