/*
  # Create Pass Activation and Management Functions
  
  1. New Functions
    - `get_available_passes(p_user_id uuid)` - Gets all unused passes for a user
    - `activate_pass(p_pass_id uuid, p_event_id uuid)` - Activates a pass and links to event
    - `get_pass_expiration(p_pass_id uuid)` - Calculates when a pass expires
    - `is_pass_active(p_pass_id uuid)` - Checks if pass is currently active
    - `deactivate_expired_passes()` - Maintenance function to deactivate expired passes
  
  2. Security
    - All functions use SECURITY DEFINER to ensure proper access control
    - Functions validate user ownership before modifying passes
    - Proper error handling for invalid inputs
  
  3. Important Notes
    - Passes are activated when user creates an event
    - Expiration is calculated as activated_at + duration_hours
    - Used by event creation flow to manage pass timing
*/

-- Function to get available (unused) passes for a user
CREATE OR REPLACE FUNCTION get_available_passes(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  tier_name text,
  duration_hours integer,
  purchased_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uep.id,
    st.name as tier_name,
    st.event_pass_duration_hours as duration_hours,
    uep.purchased_at
  FROM user_event_passes uep
  JOIN subscription_tiers st ON uep.tier_id = st.id
  WHERE uep.user_id = p_user_id
    AND uep.activated_at IS NULL
    AND st.event_pass_duration_hours IS NOT NULL
  ORDER BY uep.purchased_at ASC;
END;
$$;

-- Function to activate a pass
CREATE OR REPLACE FUNCTION activate_pass(
  p_pass_id uuid,
  p_event_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  success boolean,
  expires_at timestamptz,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration_hours integer;
  v_pass_user_id uuid;
  v_expiration timestamptz;
BEGIN
  -- Verify pass belongs to user and is not already activated
  SELECT 
    uep.user_id,
    st.event_pass_duration_hours
  INTO v_pass_user_id, v_duration_hours
  FROM user_event_passes uep
  JOIN subscription_tiers st ON uep.tier_id = st.id
  WHERE uep.id = p_pass_id;
  
  -- Check if pass exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 'Pass not found';
    RETURN;
  END IF;
  
  -- Check if pass belongs to user
  IF v_pass_user_id != p_user_id THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 'Pass does not belong to user';
    RETURN;
  END IF;
  
  -- Check if pass has duration
  IF v_duration_hours IS NULL THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 'Pass does not have duration';
    RETURN;
  END IF;
  
  -- Calculate expiration
  v_expiration := NOW() + (v_duration_hours || ' hours')::interval;
  
  -- Activate the pass
  UPDATE user_event_passes
  SET 
    activated_at = NOW(),
    event_id = p_event_id
  WHERE id = p_pass_id
    AND activated_at IS NULL;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 'Pass already activated';
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, v_expiration, 'Pass activated successfully';
END;
$$;

-- Function to get pass expiration
CREATE OR REPLACE FUNCTION get_pass_expiration(p_pass_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activated_at timestamptz;
  v_duration_hours integer;
BEGIN
  SELECT 
    uep.activated_at,
    st.event_pass_duration_hours
  INTO v_activated_at, v_duration_hours
  FROM user_event_passes uep
  JOIN subscription_tiers st ON uep.tier_id = st.id
  WHERE uep.id = p_pass_id;
  
  IF NOT FOUND OR v_activated_at IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN v_activated_at + (v_duration_hours || ' hours')::interval;
END;
$$;

-- Function to check if pass is active
CREATE OR REPLACE FUNCTION is_pass_active(p_pass_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expiration timestamptz;
BEGIN
  v_expiration := get_pass_expiration(p_pass_id);
  
  IF v_expiration IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN NOW() < v_expiration;
END;
$$;

-- Function to deactivate expired events based on pass expiration
CREATE OR REPLACE FUNCTION deactivate_expired_pass_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Deactivate events whose pass has expired
  WITH expired_passes AS (
    SELECT 
      uep.event_id,
      uep.activated_at + (st.event_pass_duration_hours || ' hours')::interval as expires_at
    FROM user_event_passes uep
    JOIN subscription_tiers st ON uep.tier_id = st.id
    WHERE uep.activated_at IS NOT NULL
      AND uep.event_id IS NOT NULL
      AND NOW() > (uep.activated_at + (st.event_pass_duration_hours || ' hours')::interval)
  )
  UPDATE events
  SET is_active = false
  FROM expired_passes
  WHERE events.id = expired_passes.event_id
    AND events.is_active = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;