/*
  # Fix FREE Tier Credit Allocation

  ## Problem
  New users signing up should receive:
  - 10 Image Credits
  - 10 SMS Credits
  - 1 Event Credit

  Current issues:
  1. SMS limit is set to 5 instead of 10
  2. New credit system columns (subscription_credits, subscription_sms_credits) are not initialized
  3. No ledger entry is created for initial credit grant

  ## Solution
  1. Update handle_new_user() trigger to:
     - Set sms_limit to 10
     - Initialize subscription_credits to 10
     - Initialize subscription_sms_credits to 10
     - Create ledger entry for audit trail

  2. Backfill existing FREE tier users with correct credits

  ## Changes
  - Drop and recreate handle_new_user() function with correct credit allocation
  - Update existing users on FREE tier to have correct credits
  - Add ledger entries for transparency
*/

-- ============================================================================
-- STEP 1: Drop existing trigger and function
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ============================================================================
-- STEP 2: Create updated trigger function with correct credit allocation
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

  -- Insert user profile
  INSERT INTO user_profiles (
    id,
    email,
    subscription_tier_id,
    subscription_status,
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
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
    10,  -- sms_limit (FIXED: was 5, now 10)
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
-- STEP 3: Create trigger
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 4: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, authenticated, anon, service_role;

-- Ensure postgres role has necessary table permissions
GRANT INSERT ON user_profiles TO postgres;
GRANT INSERT ON user_credits TO postgres;
GRANT INSERT ON credit_ledger TO postgres;
GRANT SELECT ON subscription_tiers_new TO postgres;

-- ============================================================================
-- STEP 5: Backfill existing FREE tier users with correct credits
-- ============================================================================

-- Update user_credits for existing FREE tier users who have 0 credits
UPDATE user_credits uc
SET
  sms_limit = 10,
  subscription_credits = CASE
    WHEN COALESCE(subscription_credits, 0) = 0 THEN 10
    ELSE subscription_credits
  END,
  subscription_sms_credits = CASE
    WHEN COALESCE(subscription_sms_credits, 0) = 0 THEN 10
    ELSE subscription_sms_credits
  END,
  updated_at = now()
WHERE uc.user_id IN (
  SELECT up.id
  FROM user_profiles up
  JOIN subscription_tiers_new st ON up.subscription_tier_id = st.id
  WHERE st.name = 'Free'
  AND up.subscription_status = 'active'
)
AND (
  COALESCE(uc.subscription_credits, 0) = 0
  OR COALESCE(uc.subscription_sms_credits, 0) = 0
  OR uc.sms_limit = 5
);

-- Create ledger entries for backfilled users (image credits)
INSERT INTO credit_ledger (user_id, source, amount, balance_after, metadata, created_at)
SELECT
  uc.user_id,
  'admin_grant',
  10,
  COALESCE(uc.subscription_credits, 0) + COALESCE(uc.purchased_credits, 0) + COALESCE(uc.event_credits, 0),
  jsonb_build_object(
    'type', 'backfill',
    'tier', 'Free',
    'description', 'Backfilled FREE tier image credits',
    'reason', 'Initial signup credits not properly allocated'
  ),
  now()
FROM user_credits uc
JOIN user_profiles up ON uc.user_id = up.id
JOIN subscription_tiers_new st ON up.subscription_tier_id = st.id
WHERE st.name = 'Free'
AND up.subscription_status = 'active'
AND NOT EXISTS (
  SELECT 1 FROM credit_ledger cl
  WHERE cl.user_id = uc.user_id
  AND cl.source = 'subscription'
  AND cl.metadata->>'type' = 'initial_signup'
);

-- Create ledger entries for backfilled users (SMS credits)
INSERT INTO credit_ledger (user_id, source, amount, balance_after, metadata, created_at)
SELECT
  uc.user_id,
  'admin_grant',
  10,
  COALESCE(uc.subscription_sms_credits, 0) + COALESCE(uc.purchased_sms_credits, 0) + COALESCE(uc.event_sms_credits, 0),
  jsonb_build_object(
    'type', 'backfill',
    'tier', 'Free',
    'credit_type', 'sms',
    'description', 'Backfilled FREE tier SMS credits',
    'reason', 'Initial signup credits not properly allocated'
  ),
  now()
FROM user_credits uc
JOIN user_profiles up ON uc.user_id = up.id
JOIN subscription_tiers_new st ON up.subscription_tier_id = st.id
WHERE st.name = 'Free'
AND up.subscription_status = 'active'
AND NOT EXISTS (
  SELECT 1 FROM credit_ledger cl
  WHERE cl.user_id = uc.user_id
  AND cl.source = 'subscription'
  AND cl.metadata->>'type' = 'initial_signup'
  AND cl.metadata->>'credit_type' = 'sms'
);