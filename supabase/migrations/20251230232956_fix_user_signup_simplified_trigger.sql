/*
  # Simplified User Signup Trigger
  
  ## Problem
  The complex trigger with exception handling may be masking the real error.
  Supabase Auth triggers need to be extremely simple and minimal.
  
  ## Solution
  Create a minimal trigger function that:
  1. Gets the Free tier ID
  2. Inserts into user_profiles
  3. Inserts into user_credits
  4. No complex exception handling - let errors bubble up for visibility
  
  ## Changes
  - Drop existing trigger and function
  - Create simple, minimal version
  - Let actual errors surface instead of catching them
*/

-- Step 1: Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Step 2: Create minimal trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free_tier_id uuid;
BEGIN
  -- Get Free tier ID
  SELECT id INTO v_free_tier_id
  FROM subscription_tiers_new
  WHERE name = 'Free' AND is_active = true
  LIMIT 1;
  
  -- If no Free tier found, use a fallback
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
  
  -- Insert user credits
  INSERT INTO user_credits (
    user_id,
    images_limit,
    sms_limit,
    events_limit,
    images_used,
    sms_used,
    reset_date
  )
  VALUES (
    NEW.id,
    10,
    5,
    1,
    0,
    0,
    date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Step 3: Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, authenticated, anon, service_role;

-- Step 5: Ensure postgres role has necessary table permissions
GRANT INSERT ON user_profiles TO postgres;
GRANT INSERT ON user_credits TO postgres;
GRANT SELECT ON subscription_tiers_new TO postgres;
