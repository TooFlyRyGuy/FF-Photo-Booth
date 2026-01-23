/*
  # Fix User Signup to Save Full Name

  ## Problem
  When users sign up, the full_name from the signup form is passed in raw_user_meta_data
  but the handle_new_user() trigger does not extract and save it to user_profiles.full_name.

  ## Solution
  Update the handle_new_user() function to:
  1. Extract full_name from NEW.raw_user_meta_data
  2. Save it to user_profiles.full_name column
  3. Fall back to email username if no full_name provided

  ## Changes
  - Drop and recreate handle_new_user() function with full_name extraction
*/

-- ============================================================================
-- Drop existing trigger and function
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ============================================================================
-- Create updated trigger function with full_name extraction
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free_tier_id uuid;
  v_credit_balance integer;
  v_full_name text;
BEGIN
  -- Get Free tier ID
  SELECT id INTO v_free_tier_id
  FROM subscription_tiers_new
  WHERE name = 'Free' AND is_active = true
  LIMIT 1;

  -- If no Free tier found, raise error
  IF v_free_tier_id IS NULL THEN
    RAISE EXCEPTION 'No active Free tier found';
  END IF;

  -- Extract full_name from metadata or use email username as fallback
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Insert user profile with full_name
  INSERT INTO user_profiles (
    id,
    email,
    full_name,
    subscription_tier_id,
    subscription_status,
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_free_tier_id,
    'active',
    'user'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert user credits with both OLD and NEW system columns
  INSERT INTO user_credits (
    user_id,
    images_limit,
    sms_limit,
    events_limit,
    images_used,
    sms_used,
    subscription_credits,
    subscription_sms_credits,
    purchased_credits,
    purchased_sms_credits,
    event_credits,
    event_sms_credits,
    reset_date
  )
  VALUES (
    NEW.id,
    10,  -- images_limit (old system)
    10,  -- sms_limit
    1,   -- events_limit
    0,   -- images_used
    0,   -- sms_used
    10,  -- subscription_credits (new system)
    10,  -- subscription_sms_credits (new system)
    0,   -- purchased_credits
    0,   -- purchased_sms_credits
    0,   -- event_credits
    0,   -- event_sms_credits
    date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month'
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Calculate initial balance
  v_credit_balance := 10; -- subscription_credits

  -- Create ledger entry for initial subscription credits
  INSERT INTO credit_ledger (
    user_id,
    source,
    amount,
    balance_after,
    metadata,
    created_at
  )
  VALUES (
    NEW.id,
    'subscription',
    10,
    v_credit_balance,
    jsonb_build_object(
      'type', 'initial_signup',
      'tier', 'Free',
      'description', 'Initial FREE tier image credits'
    ),
    now()
  );

  -- Create ledger entry for initial SMS credits (tracked separately)
  INSERT INTO credit_ledger (
    user_id,
    source,
    amount,
    balance_after,
    metadata,
    created_at
  )
  VALUES (
    NEW.id,
    'subscription',
    10,
    10,
    jsonb_build_object(
      'type', 'initial_signup',
      'tier', 'Free',
      'credit_type', 'sms',
      'description', 'Initial FREE tier SMS credits'
    ),
    now()
  );

  RETURN NEW;
END;
$$;

-- ============================================================================
-- Create trigger
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, authenticated, anon, service_role;

-- Ensure postgres role has necessary table permissions
GRANT INSERT ON user_profiles TO postgres;
GRANT INSERT ON user_credits TO postgres;
GRANT INSERT ON credit_ledger TO postgres;
GRANT SELECT ON subscription_tiers_new TO postgres;
