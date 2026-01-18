/*
  # Fix Ambiguous Column Reference in validate_event_time_restrictions
  
  1. Issue Fixed
    - Column reference "error_message" was ambiguous in validate_event_time_restrictions function
    - Both the function's return type and the can_create_concurrent_event subquery have error_message
    - This caused 400 errors when trying to validate event restrictions
  
  2. Solution
    - Add proper table alias when selecting from can_create_concurrent_event
    - Explicitly qualify the column selection to avoid ambiguity
  
  3. Impact
    - Event creation with event passes will now work correctly
    - Validation error messages will be properly returned to the frontend
*/

-- Drop and recreate the function with proper column aliasing
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
  v_has_active_sub boolean;
  v_has_available_passes boolean;
  v_subscription_type text;
  v_can_create boolean;
  v_current_count integer;
  v_limit_count integer;
  v_limit_error text;
  v_event_source text;
BEGIN
  -- Determine event source
  IF p_pass_id IS NOT NULL THEN
    v_event_source := 'event_pass';
  ELSE
    v_event_source := 'subscription';
  END IF;
  
  -- Check concurrent event limits for subscription events
  IF v_event_source = 'subscription' THEN
    -- FIX: Add table alias 'c' to avoid ambiguous column reference
    SELECT 
      c.can_create, 
      c.current_count, 
      c.limit_count, 
      c.error_message
    INTO v_can_create, v_current_count, v_limit_count, v_limit_error
    FROM can_create_concurrent_event(p_user_id, p_event_id, v_event_source) c;
    
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
        'Please select an event pass to create this event, or subscribe to a monthly/yearly plan for unlimited events.'::text,
        'pass_or_subscription_required'::text;
      RETURN;
    ELSE
      RETURN QUERY SELECT 
        false,
        'You need an active subscription or event pass to create events. Please purchase a plan.'::text,
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