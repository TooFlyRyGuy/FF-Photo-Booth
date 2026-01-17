/*
  # Allow ADMIN to Bypass Event Pass Requirements

  1. Changes
    - Update `validate_event_time_restrictions` function to check if user is admin
    - ADMIN users can create events without event passes or subscriptions
    - ADMIN users can create unlimited duration events
    - Maintains all existing validation for non-admin users

  2. Business Rules for ADMIN
    - ADMIN users bypass all event creation restrictions
    - No event pass required
    - No subscription required
    - No time restrictions enforced
    - Full administrative privileges

  3. Notes
    - Check is performed first before any other validation
    - Uses role field from user_profiles table
    - Case-insensitive role check for safety
*/

-- Drop and recreate function with admin bypass
DROP FUNCTION IF EXISTS validate_event_time_restrictions(uuid, timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION validate_event_time_restrictions(
  p_user_id uuid,
  p_start_datetime timestamptz,
  p_end_datetime timestamptz,
  p_pass_id uuid
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
  
  -- Get user subscription type for non-admin users
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
        'You have an active subscription. Event passes are not needed for subscription accounts.',
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
        'Selected event pass is invalid or already activated.',
        'invalid_pass'::text;
      RETURN;
    END IF;
    
    -- Event pass events MUST have time restrictions
    IF p_start_datetime IS NULL OR p_end_datetime IS NULL THEN
      RETURN QUERY SELECT
        false,
        'Event pass events must have start and end times specified.',
        'pass_requires_times'::text;
      RETURN;
    END IF;
    
    -- Validate end time is after start time
    IF p_end_datetime <= p_start_datetime THEN
      RETURN QUERY SELECT
        false,
        'Event end time must be after start time.',
        'invalid_time_range'::text;
      RETURN;
    END IF;
    
    RETURN QUERY SELECT
      true,
      NULL::text,
      'event_pass_valid'::text;
    RETURN;
  END IF;
  
  -- Case 3: User has no subscription and no pass selected
  IF NOT v_has_active_sub AND p_pass_id IS NULL THEN
    IF v_has_available_passes THEN
      RETURN QUERY SELECT
        false,
        'Please select an event pass to create this event, or subscribe to a monthly/yearly plan for unlimited events.',
        'pass_or_subscription_required'::text;
      RETURN;
    ELSE
      RETURN QUERY SELECT
        false,
        'You need an active subscription or event pass to create events. Please purchase a plan.',
        'no_access'::text;
      RETURN;
    END IF;
  END IF;
  
  -- Default case
  RETURN QUERY SELECT
    true,
    NULL::text,
    'default'::text;
END;
$$;
