/*
  # Fix get_user_subscription_type Event Pass Join
  
  1. Issue Fixed
    - get_user_subscription_type function joins user_event_passes with subscription_tiers
    - Should join with event_passes table using event_pass_id instead of tier_id
  
  2. Solution
    - Update the JOIN to use event_passes instead of subscription_tiers
    - Reference event_passes.duration_hours instead of subscription_tiers.event_pass_duration_hours
  
  3. Impact
    - User subscription type detection will correctly identify available event passes
    - Event pass validation will work properly
*/

-- Drop and recreate get_user_subscription_type function
DROP FUNCTION IF EXISTS get_user_subscription_type(uuid);

CREATE OR REPLACE FUNCTION get_user_subscription_type(p_user_id uuid)
RETURNS TABLE (
  subscription_type text,
  tier_name text,
  has_active_sub boolean,
  has_available_passes boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_active_sub boolean;
  v_tier_name text;
  v_subscription_status text;
  v_available_passes_count integer;
BEGIN
  -- Get subscription info
  SELECT 
    up.subscription_status,
    st.name
  INTO v_subscription_status, v_tier_name
  FROM user_profiles up
  LEFT JOIN subscription_tiers_new st ON up.subscription_tier_id = st.id
  WHERE up.id = p_user_id;
  
  -- Check for active subscription
  v_has_active_sub := has_active_subscription(p_user_id);
  
  -- Count available event passes - FIXED: Join with event_passes instead of subscription_tiers
  SELECT COUNT(*)
  INTO v_available_passes_count
  FROM user_event_passes uep
  JOIN event_passes ep ON uep.event_pass_id = ep.id
  WHERE uep.user_id = p_user_id
    AND uep.activated_at IS NULL
    AND ep.duration_hours IS NOT NULL;
  
  -- Determine subscription type
  IF v_has_active_sub THEN
    RETURN QUERY SELECT 
      'subscription'::text,
      v_tier_name,
      true,
      v_available_passes_count > 0;
  ELSIF v_available_passes_count > 0 THEN
    RETURN QUERY SELECT 
      'event_pass'::text,
      v_tier_name,
      false,
      true;
  ELSE
    RETURN QUERY SELECT 
      'free'::text,
      COALESCE(v_tier_name, 'Free'),
      false,
      false;
  END IF;
END;
$$;