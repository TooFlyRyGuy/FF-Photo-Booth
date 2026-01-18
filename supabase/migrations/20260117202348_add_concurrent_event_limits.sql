/*
  # Add Concurrent Event Limits for Subscription Users

  1. New Functions
    - `count_user_active_events(p_user_id uuid, p_exclude_event_id uuid)` - Count currently active subscription events
    - `get_user_concurrent_event_limit(p_user_id uuid)` - Get user's allowed concurrent events from subscription
    - `can_create_concurrent_event(p_user_id uuid, p_event_id uuid)` - Check if user can create another concurrent event

  2. Schema Changes
    - Add `event_source` to events table to track subscription vs event pass events
    - Add index for efficient concurrent event counting

  3. Business Rules
    - Subscription users are limited by their tier's concurrent_events value
    - Event pass events don't count toward subscription concurrent limits
    - Admin users bypass all limits
    - Active events = is_active = true AND (no time limits OR currently within time window)

  4. Important Notes
    - Event pass events are tracked separately and don't affect subscription limits
    - Users can purchase event passes even with active subscriptions
    - Clear error messages guide users when limits are reached
*/

-- Add event_source column to track how event was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'event_source'
  ) THEN
    ALTER TABLE events ADD COLUMN event_source text DEFAULT 'subscription' CHECK (event_source IN ('subscription', 'event_pass', 'admin'));
  END IF;
END $$;

-- Add index for efficient active event counting
CREATE INDEX IF NOT EXISTS idx_events_user_active_source 
  ON events(user_id, is_active, event_source) 
  WHERE is_active = true;

-- Function to count user's currently active subscription events
CREATE OR REPLACE FUNCTION count_user_active_events(
  p_user_id uuid,
  p_exclude_event_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Count events that are:
  -- 1. Created by this user
  -- 2. Is active
  -- 3. From subscription (not event pass)
  -- 4. Either has no time limits OR is currently within time window
  SELECT COUNT(*)
  INTO v_count
  FROM events e
  WHERE e.user_id = p_user_id
    AND e.is_active = true
    AND e.event_source = 'subscription'
    AND (e.id != p_exclude_event_id OR p_exclude_event_id IS NULL)
    AND (
      -- No time limits (always active)
      (e.start_datetime IS NULL AND e.end_datetime IS NULL)
      OR
      -- Within time window
      (e.start_datetime IS NOT NULL AND e.end_datetime IS NOT NULL 
       AND NOW() >= e.start_datetime AND NOW() <= e.end_datetime)
      OR
      -- Started but no end time
      (e.start_datetime IS NOT NULL AND e.end_datetime IS NULL 
       AND NOW() >= e.start_datetime)
    );
  
  RETURN v_count;
END;
$$;

-- Function to get user's concurrent event limit from subscription
CREATE OR REPLACE FUNCTION get_user_concurrent_event_limit(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_role text;
BEGIN
  -- Check if user is admin - admins have no limits
  SELECT role INTO v_role
  FROM user_profiles
  WHERE id = p_user_id;
  
  IF v_role = 'admin' THEN
    RETURN 999999; -- Effectively unlimited
  END IF;
  
  -- First check new user_subscriptions table
  SELECT st.concurrent_events
  INTO v_limit
  FROM user_subscriptions us
  JOIN subscription_tiers_new st ON us.tier_id = st.id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND us.current_period_end > NOW()
  ORDER BY us.created_at DESC
  LIMIT 1;
  
  -- If found in new table, return it
  IF v_limit IS NOT NULL THEN
    RETURN v_limit;
  END IF;
  
  -- Fallback to old user_profiles table
  SELECT st.concurrent_events
  INTO v_limit
  FROM user_profiles up
  JOIN subscription_tiers_new st ON up.subscription_tier_id = st.id
  WHERE up.id = p_user_id
    AND up.subscription_status = 'active';
  
  -- Return limit or NULL if no active subscription
  RETURN v_limit;
END;
$$;

-- Function to check if user can create another concurrent event
CREATE OR REPLACE FUNCTION can_create_concurrent_event(
  p_user_id uuid,
  p_event_id uuid DEFAULT NULL,
  p_event_source text DEFAULT 'subscription'
)
RETURNS TABLE (
  can_create boolean,
  current_count integer,
  limit_count integer,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count integer;
  v_limit integer;
  v_role text;
BEGIN
  -- Check if user is admin
  SELECT role INTO v_role
  FROM user_profiles
  WHERE id = p_user_id;
  
  IF v_role = 'admin' THEN
    RETURN QUERY SELECT true, 0, 999999, NULL::text;
    RETURN;
  END IF;
  
  -- Event pass events don't count toward subscription limits
  IF p_event_source = 'event_pass' THEN
    RETURN QUERY SELECT true, 0, 999999, NULL::text;
    RETURN;
  END IF;
  
  -- Get current count and limit
  v_current_count := count_user_active_events(p_user_id, p_event_id);
  v_limit := get_user_concurrent_event_limit(p_user_id);
  
  -- If no limit found (no active subscription), return error
  IF v_limit IS NULL THEN
    RETURN QUERY SELECT 
      false,
      v_current_count,
      0,
      'You need an active subscription to create events, or you can purchase an event pass for time-limited events.'::text;
    RETURN;
  END IF;
  
  -- Check if under limit
  IF v_current_count < v_limit THEN
    RETURN QUERY SELECT 
      true,
      v_current_count,
      v_limit,
      NULL::text;
    RETURN;
  END IF;
  
  -- At or over limit
  RETURN QUERY SELECT 
    false,
    v_current_count,
    v_limit,
    format('You have reached your limit of %s concurrent active event%s. Please deactivate an existing event, upgrade your plan, or purchase an event pass for additional events.',
      v_limit,
      CASE WHEN v_limit = 1 THEN '' ELSE 's' END
    )::text;
END;
$$;

-- Update the validate_event_time_restrictions function to include concurrent event checks
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

-- Create index for subscription status queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_status 
  ON user_profiles(subscription_status, subscription_tier_id);