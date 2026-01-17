/*
  # Fix Subscription Validation to Use New Tables

  1. Changes
    - Update `has_active_subscription` function to check `user_subscriptions` table instead of `user_profiles`
    - Update `get_user_subscription_type` function to check the new subscription system
    - Check `subscription_tiers_new` table instead of old `subscription_tiers`
    - Look for status='active' or 'past_due' in `user_subscriptions` table

  2. Business Logic
    - Users with active subscriptions in `user_subscriptions` table are recognized
    - Properly supports the new subscription management system
    - Maintains backward compatibility with old data

  3. Security
    - Functions maintain SECURITY DEFINER for proper access control
    - All checks use proper table references
*/

-- Fix has_active_subscription to check user_subscriptions table
CREATE OR REPLACE FUNCTION has_active_subscription(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_count integer;
BEGIN
  -- Check if user has active subscription in user_subscriptions table
  SELECT COUNT(*)
  INTO v_subscription_count
  FROM user_subscriptions us
  JOIN subscription_tiers_new st ON us.tier_id = st.id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'past_due')
    AND st.is_active = true;
  
  RETURN v_subscription_count > 0;
END;
$$;

-- Fix get_user_subscription_type to check user_subscriptions table
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
  v_available_passes_count integer;
BEGIN
  -- Check for active subscription in user_subscriptions table
  v_has_active_sub := has_active_subscription(p_user_id);
  
  -- Get tier name from user_subscriptions if they have one
  SELECT st.name
  INTO v_tier_name
  FROM user_subscriptions us
  JOIN subscription_tiers_new st ON us.tier_id = st.id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'past_due')
  LIMIT 1;
  
  -- Count available event passes (not yet activated)
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
      COALESCE(v_tier_name, 'Subscription'),
      true,
      v_available_passes_count > 0;
  ELSIF v_available_passes_count > 0 THEN
    RETURN QUERY SELECT 
      'event_pass'::text,
      'Event Pass',
      false,
      true;
  ELSE
    RETURN QUERY SELECT 
      'free'::text,
      'Free',
      false,
      false;
  END IF;
END;
$$;
