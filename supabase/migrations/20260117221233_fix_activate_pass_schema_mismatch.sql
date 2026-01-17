/*
  # Fix Schema Mismatch in Pass Activation Functions
  
  1. Issue Fixed
    - activate_pass function referenced tier_id which doesn't exist in user_event_passes
    - user_event_passes uses event_pass_id to reference event_passes table
    - get_available_passes also had the same incorrect reference
  
  2. Solution
    - Update activate_pass to join with event_passes using event_pass_id
    - Update get_available_passes to join with event_passes using event_pass_id
    - Update get_pass_expiration to use correct join
  
  3. Impact
    - Pass activation will now work correctly
    - Pass duration will be calculated from event_passes.duration_hours
    - Available passes will display correct information
*/

-- Drop and recreate get_available_passes function
DROP FUNCTION IF EXISTS get_available_passes(uuid);

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
    ep.name as tier_name,
    ep.duration_hours,
    uep.created_at as purchased_at
  FROM user_event_passes uep
  JOIN event_passes ep ON uep.event_pass_id = ep.id
  WHERE uep.user_id = p_user_id
    AND uep.activated_at IS NULL
    AND ep.duration_hours IS NOT NULL
  ORDER BY uep.created_at ASC;
END;
$$;

-- Drop and recreate activate_pass function
DROP FUNCTION IF EXISTS activate_pass(uuid, uuid, uuid);

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
    ep.duration_hours
  INTO v_pass_user_id, v_duration_hours
  FROM user_event_passes uep
  JOIN event_passes ep ON uep.event_pass_id = ep.id
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
    event_id = p_event_id,
    expires_at = v_expiration,
    is_active = true
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

-- Drop and recreate get_pass_expiration function
DROP FUNCTION IF EXISTS get_pass_expiration(uuid);

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
    ep.duration_hours
  INTO v_activated_at, v_duration_hours
  FROM user_event_passes uep
  JOIN event_passes ep ON uep.event_pass_id = ep.id
  WHERE uep.id = p_pass_id;
  
  IF NOT FOUND OR v_activated_at IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN v_activated_at + (v_duration_hours || ' hours')::interval;
END;
$$;

-- Drop and recreate deactivate_expired_pass_events function
DROP FUNCTION IF EXISTS deactivate_expired_pass_events();

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
      uep.activated_at + (ep.duration_hours || ' hours')::interval as expires_at
    FROM user_event_passes uep
    JOIN event_passes ep ON uep.event_pass_id = ep.id
    WHERE uep.activated_at IS NOT NULL
      AND uep.event_id IS NOT NULL
      AND NOW() > (uep.activated_at + (ep.duration_hours || ' hours')::interval)
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