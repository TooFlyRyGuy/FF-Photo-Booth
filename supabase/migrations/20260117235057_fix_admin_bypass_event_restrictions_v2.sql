/*
  # Fix Admin Bypass for Event Restrictions

  ## Problem
  The validate_event_time_restrictions function lost the admin bypass check when 
  concurrent event limits were added. Admins are being restricted by subscription 
  requirements when creating events.

  ## Solution
  Add admin check at the beginning of validate_event_time_restrictions to bypass 
  all restrictions for admin users.

  ## Changes
  1. Drop existing validate_event_time_restrictions function
  2. Recreate with admin check at the beginning
  3. If admin, return immediately with success (admin_unlimited)
  4. Maintains all existing validation for non-admin users

  ## Security
  - Only users with role = 'admin' in user_profiles bypass restrictions
  - Case-insensitive role check for safety
  - All other users continue through normal validation flow
*/

-- ============================================================================
-- Drop and recreate validate_event_time_restrictions with admin bypass
-- ============================================================================

DROP FUNCTION IF EXISTS validate_event_time_restrictions(uuid, timestamptz, timestamptz, uuid, uuid);
DROP FUNCTION IF EXISTS validate_event_time_restrictions(uuid, timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION validate_event_time_restrictions(
  p_user_id uuid,
  p_start_datetime timestamptz,
  p_end_datetime timestamptz,
  p_pass_id uuid,
  p_event_id uuid DEFAULT NULL
)
RETURNS TABLE (
  is_valid boolean,
  error_message text,
  restriction_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_has_active_sub boolean;
  v_has_available_passes boolean;
  v_subscription_type text;
  v_can_create boolean;
  v_current_count integer;
  v_limit_count integer;
  v_limit_error text;
  v_event_source text;
BEGIN
  -- Case 0: Check if user is ADMIN - bypass all restrictions
  SELECT LOWER(role)
  INTO v_user_role
  FROM user_profiles
  WHERE id = p_user_id;
  
  IF v_user_role = 'admin' THEN
    RETURN QUERY SELECT
      true,
      NULL::text,
      'admin_unlimited'::text;
    RETURN;
  END IF;

  -- Determine event source
  IF p_pass_id IS NOT NULL THEN
    v_event_source := 'event_pass';
  ELSE
    v_event_source := 'subscription';
  END IF;
  
  -- Check concurrent event limits for subscription events
  IF v_event_source = 'subscription' THEN
    SELECT can_create, current_count, limit_count, error_message
    INTO v_can_create, v_current_count, v_limit_count, v_limit_error
    FROM can_create_concurrent_event(p_user_id, p_event_id, v_event_source);
    
    IF NOT v_can_create THEN
      RETURN QUERY SELECT 
        false,
        v_limit_error,
        'concurrent_limit_reached'::text;
      RETURN;
    END IF;
  END IF;
  
  -- Get user subscription type
  SELECT 
    subscription_type,
    has_active_sub,
    has_available_passes
  INTO v_subscription_type, v_has_active_sub, v_has_available_passes
  FROM get_user_subscription_type(p_user_id);
  
  -- Case 1: User has active subscription
  IF v_has_active_sub THEN
    -- Subscription users should NOT use event passes
    IF p_pass_id IS NOT NULL THEN
      RETURN QUERY SELECT 
        false,
        'You have an active subscription. Event passes are not needed for subscription accounts.'::text,
        'subscription_no_pass'::text;
      RETURN;
    END IF;
    
    -- Subscription users can have unlimited events (no time restrictions required)
    RETURN QUERY SELECT 
      true,
      NULL::text,
      'subscription_unlimited'::text;
    RETURN;
  END IF;
  
  -- Case 2: User wants to use event pass
  IF p_pass_id IS NOT NULL THEN
    -- Verify pass exists and belongs to user
    IF NOT EXISTS (
      SELECT 1 FROM user_event_passes
      WHERE id = p_pass_id
        AND user_id = p_user_id
        AND activated_at IS NULL
    ) THEN
      RETURN QUERY SELECT 
        false,
        'Selected event pass is invalid or already activated.'::text,
        'invalid_pass'::text;
      RETURN;
    END IF;
    
    -- Event pass events MUST have time restrictions
    IF p_start_datetime IS NULL OR p_end_datetime IS NULL THEN
      RETURN QUERY SELECT 
        false,
        'Event pass events must have start and end times specified.'::text,
        'pass_requires_times'::text;
      RETURN;
    END IF;
    
    -- Validate end time is after start time
    IF p_end_datetime <= p_start_datetime THEN
      RETURN QUERY SELECT 
        false,
        'Event end time must be after start time.'::text,
        'invalid_time_range'::text;
      RETURN;
    END IF;
    
    -- Event pass events are valid
    RETURN QUERY SELECT 
      true,
      NULL::text,
      'event_pass_valid'::text;
    RETURN;
  END IF;
  
  -- Case 3: Free tier user without passes trying to create event
  RETURN QUERY SELECT 
    false,
    'You need an active subscription or event pass to create events.'::text,
    'no_subscription_or_pass'::text;
END;
$$;

COMMENT ON FUNCTION validate_event_time_restrictions IS
  'Validates event creation restrictions based on user subscription type. Admins bypass all checks.';
