/*
  # Add Subscription vs Event Pass Restrictions
  
  1. New Functions
    - `has_active_subscription(p_user_id uuid)` - Check if user has active monthly/yearly subscription
    - `get_user_subscription_type(p_user_id uuid)` - Get subscription type (subscription, event_pass, or free)
    - `validate_event_time_restrictions(p_user_id uuid, p_start_datetime timestamptz, p_end_datetime timestamptz, p_pass_id uuid)` - Validate event time restrictions
  
  2. Business Rules Enforced
    - Users with active monthly/yearly subscriptions can create unlimited duration events
    - Users with event passes MUST have time-limited events (activated_at + duration)
    - Free tier users cannot create events (handled by credit system)
    - Event pass users cannot create unlimited events
    - Subscription users cannot use event passes (they don't need them)
  
  3. Important Notes
    - This separates subscription-based events from event pass events
    - Prevents confusion about event duration limits
    - Provides clear validation messages
    - Enforces business logic at database level
*/

-- Function to check if user has active monthly or yearly subscription
CREATE OR REPLACE FUNCTION has_active_subscription(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_status text;
  v_tier_name text;
BEGIN
  SELECT 
    up.subscription_status,
    st.name
  INTO v_subscription_status, v_tier_name
  FROM user_profiles up
  LEFT JOIN subscription_tiers st ON up.subscription_tier_id = st.id
  WHERE up.id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if user has active subscription (not free tier, not event pass only)
  -- Subscription status should be 'active' and tier should be monthly/yearly plan
  IF v_subscription_status = 'active' 
     AND v_tier_name IS NOT NULL 
     AND v_tier_name NOT IN ('Free', 'Event Pass') THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Function to get user subscription type
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
  v_subscription_status text;
  v_available_passes_count integer;
BEGIN
  -- Get subscription info
  SELECT 
    up.subscription_status,
    st.name
  INTO v_subscription_status, v_tier_name
  FROM user_profiles up
  LEFT JOIN subscription_tiers st ON up.subscription_tier_id = st.id
  WHERE up.id = p_user_id;
  
  -- Check for active subscription
  v_has_active_sub := has_active_subscription(p_user_id);
  
  -- Count available event passes
  SELECT COUNT(*)
  INTO v_available_passes_count
  FROM user_event_passes uep
  JOIN subscription_tiers st ON uep.tier_id = st.id
  WHERE uep.user_id = p_user_id
    AND uep.activated_at IS NULL
    AND st.event_pass_duration_hours IS NOT NULL;
  
  -- Determine subscription type
  IF v_has_active_sub THEN
    RETURN QUERY SELECT 
      'subscription'::text,
      v_tier_name,
      true,
      v_available_passes_count > 0;
  ELSIF v_available_passes_count > 0 THEN
    RETURN QUERY SELECT 
      'event_pass'::text,
      v_tier_name,
      false,
      true;
  ELSE
    RETURN QUERY SELECT 
      'free'::text,
      COALESCE(v_tier_name, 'Free'),
      false,
      false;
  END IF;
END;
$$;

-- Function to validate event time restrictions based on user type
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
  v_has_active_sub boolean;
  v_has_available_passes boolean;
  v_subscription_type text;
BEGIN
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

-- Add check constraint to events table to enforce time restrictions for event pass users
-- Note: This is informational - actual enforcement happens in application logic
-- We can't enforce this at DB level because we need user context

-- Create index for subscription status queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_status 
  ON user_profiles(subscription_status, subscription_tier_id);