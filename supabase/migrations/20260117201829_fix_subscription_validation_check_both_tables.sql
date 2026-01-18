/*
  # Fix Subscription Validation to Check Both Old and New Tables

  1. Changes
    - Update `has_active_subscription` function to check BOTH:
      - New `user_subscriptions` table
      - Old `user_profiles` subscription fields (subscription_tier_id, subscription_status)
    - Ensures backward compatibility with users who have subscriptions in the old system
    - User has active subscription if EITHER location shows active status

  2. Business Logic
    - Check new user_subscriptions table first
    - If no active subscription found, check old user_profiles fields
    - Status is active if subscription_status = 'active' or 'past_due'
    - Must have valid subscription_tier_id

  3. Security
    - Function maintains SECURITY DEFINER for proper access control
*/

-- Fix has_active_subscription to check BOTH tables
CREATE OR REPLACE FUNCTION has_active_subscription(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_subscription_count integer;
  v_old_subscription_active boolean;
BEGIN
  -- Check new user_subscriptions table first
  SELECT COUNT(*)
  INTO v_new_subscription_count
  FROM user_subscriptions us
  JOIN subscription_tiers_new st ON us.tier_id = st.id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'past_due')
    AND st.is_active = true;
  
  IF v_new_subscription_count > 0 THEN
    RETURN true;
  END IF;
  
  -- Check old user_profiles subscription fields for backward compatibility
  SELECT 
    CASE 
      WHEN subscription_tier_id IS NOT NULL 
        AND LOWER(subscription_status) IN ('active', 'past_due')
      THEN true
      ELSE false
    END
  INTO v_old_subscription_active
  FROM user_profiles
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_old_subscription_active, false);
END;
$$;

-- Update get_user_subscription_type to check both tables as well
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
  -- Check for active subscription (checks both tables)
  v_has_active_sub := has_active_subscription(p_user_id);
  
  -- Get tier name from new user_subscriptions table first
  SELECT st.name
  INTO v_tier_name
  FROM user_subscriptions us
  JOIN subscription_tiers_new st ON us.tier_id = st.id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'past_due')
  LIMIT 1;
  
  -- If no tier name found in new table, check old user_profiles fields
  IF v_tier_name IS NULL THEN
    SELECT st.name
    INTO v_tier_name
    FROM user_profiles up
    LEFT JOIN subscription_tiers_new st ON up.subscription_tier_id = st.id
    WHERE up.id = p_user_id
      AND up.subscription_tier_id IS NOT NULL
      AND LOWER(up.subscription_status) IN ('active', 'past_due');
  END IF;
  
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
