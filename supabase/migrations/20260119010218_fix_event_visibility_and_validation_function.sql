/*
  # Fix Event Visibility and Validation Function

  ## Issues Fixed
  1. **Event Visibility RLS**: Remove ability for all authenticated users to view all active events
     - Users should only see: their own events, events shared with them, or all events if admin
  
  2. **Ambiguous Column Error**: Fix "error_message" ambiguity in validate_event_time_restrictions function
     - The function returns error_message, and also selects from another function that returns error_message
     - This causes PostgreSQL to be unable to determine which error_message is being referenced

  ## Changes

  ### 1. Update Events RLS Policy
  - Remove the `(is_active = true)` condition from authenticated users SELECT policy
  - Users can only view:
    - Events they created (user_id = auth.uid() OR created_by = auth.uid())
    - Events shared with them via event_access table
    - All events if they are admin

  ### 2. Fix validate_event_time_restrictions Function
  - Add explicit column aliases when selecting from can_create_concurrent_event
  - Use qualified variable names to avoid ambiguity

  ## Security
  - Maintains proper access control for events
  - Prevents unauthorized access to other users' events
  - Preserves admin override capabilities
*/

-- Drop and recreate the events SELECT policy for authenticated users
DROP POLICY IF EXISTS "Users can view own, shared, active, or all if admin" ON events;

CREATE POLICY "Users can view own, shared, or all if admin"
  ON events
  FOR SELECT
  TO authenticated
  USING (
    -- User owns the event (either created_by or user_id)
    (created_by = auth.uid()) 
    OR (user_id = auth.uid())
    -- User has been granted access to the event
    OR (EXISTS (
      SELECT 1
      FROM event_access
      WHERE event_access.event_id = events.id
      AND event_access.user_id = auth.uid()
    ))
    -- User is admin (can see all events)
    OR is_current_user_admin()
  );

-- Fix the validate_event_time_restrictions function to avoid ambiguous column references
CREATE OR REPLACE FUNCTION validate_event_time_restrictions(
  p_user_id uuid,
  p_start_datetime timestamptz,
  p_end_datetime timestamptz,
  p_pass_id uuid,
  p_event_id uuid DEFAULT NULL
)
RETURNS TABLE(is_valid boolean, error_message text, restriction_type text)
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
    -- FIX: Use explicit aliases to avoid ambiguous column references
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
