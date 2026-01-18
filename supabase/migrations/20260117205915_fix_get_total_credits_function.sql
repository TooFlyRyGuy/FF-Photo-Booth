/*
  # Fix get_total_credits Function
  
  1. Changes
    - Update function to use correct column names (subscription_credits, purchased_credits, event_credits)
    - Remove expires_at check as credits don't expire individually
  
  2. Security
    - Maintains SECURITY DEFINER for service role access
*/

-- Drop and recreate the function with correct column names
DROP FUNCTION IF EXISTS get_total_credits(uuid);

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

GRANT EXECUTE ON FUNCTION get_total_credits(uuid) TO anon, authenticated;
