/*
  # Fix Trigger Search Path to Include Auth Schema
  
  ## Problem
  The handle_new_user() trigger function has search_path set to only 'public',
  but it needs to access the auth schema for:
  1. Reading from auth.users for foreign key validation
  2. Ensuring the foreign key constraint on user_profiles.id works properly
  
  ## Solution
  Update the function to have search_path = 'public', 'auth'
  
  ## Changes
  - Recreate function with proper search_path
  - Maintain all existing logic
*/

-- Drop and recreate the function with correct search_path
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
DECLARE
  v_free_tier_id uuid;
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, authenticated, anon, service_role;
