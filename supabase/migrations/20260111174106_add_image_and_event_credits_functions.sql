/*
  # Add Image and Event Credits Functions

  1. New Functions
    - `get_user_image_credits(user_id)` - Returns the sum of subscription_credits + purchased_credits
    - `get_user_event_credits(user_id)` - Returns the event_credits value
    
  2. Purpose
    - Separate image generation credits from event credits
    - Image credits = subscription_credits + purchased_credits (for generating images)
    - Event credits = event_credits (for creating/managing events)
    - Calculate totals at the database level for consistency
*/

-- Drop the old function
DROP FUNCTION IF EXISTS get_user_total_credits(uuid);

-- Function to get image generation credits (subscription + purchased)
CREATE OR REPLACE FUNCTION get_user_image_credits(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_total integer;
BEGIN
  SELECT COALESCE(subscription_credits, 0) + COALESCE(purchased_credits, 0)
  INTO v_total
  FROM user_credits
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(v_total, 0);
END;
$$;

-- Function to get event credits
CREATE OR REPLACE FUNCTION get_user_event_credits(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_credits integer;
BEGIN
  SELECT COALESCE(event_credits, 0)
  INTO v_credits
  FROM user_credits
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(v_credits, 0);
END;
$$;