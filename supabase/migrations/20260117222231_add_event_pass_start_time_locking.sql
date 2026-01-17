/*
  # Lock Event Start Time Once Event Pass is Activated
  
  1. Purpose
    - Prevent users from changing event start time after activating an event pass
    - This is critical because pass expiration is calculated from the start time
    - Once a pass is activated, the duration countdown begins and cannot be changed
  
  2. New Functions
    - has_activated_event_pass(event_id) - Check if an event has an activated pass
    - can_modify_event_start_time(event_id, user_id) - Validate if start time can be changed
  
  3. Validation Rules
    - If event has NO activated pass: start time can be modified freely
    - If event has activated pass: start time CANNOT be modified
    - Admin users can bypass this restriction for support purposes
  
  4. Important Notes
    - This only applies to events created with event passes
    - Subscription-based events can still modify start times freely
    - The restriction applies from the moment the pass is activated
*/

-- Function to check if an event has an activated event pass
CREATE OR REPLACE FUNCTION has_activated_event_pass(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_pass boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM user_event_passes
    WHERE event_id = p_event_id
      AND activated_at IS NOT NULL
  ) INTO v_has_pass;
  
  RETURN COALESCE(v_has_pass, false);
END;
$$;

-- Function to check if user can modify event start time
CREATE OR REPLACE FUNCTION can_modify_event_start_time(
  p_event_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  can_modify boolean,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_has_activated_pass boolean;
  v_is_owner boolean;
BEGIN
  -- Check if user is admin
  v_is_admin := is_admin(p_user_id);
  
  -- Admin can always modify
  IF v_is_admin THEN
    RETURN QUERY SELECT true, 'Admin override'::text;
    RETURN;
  END IF;
  
  -- Check if user owns the event
  SELECT EXISTS (
    SELECT 1 FROM events
    WHERE id = p_event_id
      AND created_by = p_user_id
  ) INTO v_is_owner;
  
  IF NOT v_is_owner THEN
    RETURN QUERY SELECT false, 'Not event owner'::text;
    RETURN;
  END IF;
  
  -- Check if event has an activated pass
  v_has_activated_pass := has_activated_event_pass(p_event_id);
  
  IF v_has_activated_pass THEN
    RETURN QUERY SELECT 
      false, 
      'Cannot modify start time: Event pass has been activated and the duration countdown has begun. The start time is now locked.'::text;
    RETURN;
  END IF;
  
  -- No activated pass, can modify
  RETURN QUERY SELECT true, 'Can modify'::text;
END;
$$;

-- Add a trigger to prevent start time modifications on events with activated passes
CREATE OR REPLACE FUNCTION prevent_start_time_change_with_activated_pass()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_activated_pass boolean;
  v_is_admin boolean;
  v_start_time_changed boolean;
BEGIN
  -- Only check on UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    -- Check if start_datetime is being changed
    v_start_time_changed := (OLD.start_datetime IS DISTINCT FROM NEW.start_datetime);
    
    -- If start time hasn't changed, allow the update
    IF NOT v_start_time_changed THEN
      RETURN NEW;
    END IF;
    
    -- Check if user is admin (using auth.uid())
    v_is_admin := is_admin(auth.uid());
    
    -- Admin can bypass
    IF v_is_admin THEN
      RETURN NEW;
    END IF;
    
    -- Check if event has activated pass
    v_has_activated_pass := has_activated_event_pass(OLD.id);
    
    IF v_has_activated_pass THEN
      RAISE EXCEPTION 'Cannot modify start time: Event pass has been activated. The start time is now locked.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on events table
DROP TRIGGER IF EXISTS prevent_start_time_change_on_events ON events;

CREATE TRIGGER prevent_start_time_change_on_events
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_start_time_change_with_activated_pass();

-- Add helpful comment
COMMENT ON FUNCTION has_activated_event_pass IS 
  'Checks if an event has an activated event pass. Used to determine if start time can be modified.';

COMMENT ON FUNCTION can_modify_event_start_time IS 
  'Validates if a user can modify an event start time. Returns false if event has an activated pass (except for admins).';

COMMENT ON TRIGGER prevent_start_time_change_on_events ON events IS 
  'Prevents start time modifications for events with activated event passes. Admin users can bypass this restriction.';