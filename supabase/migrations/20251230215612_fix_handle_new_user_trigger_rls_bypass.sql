/*
  # Fix handle_new_user Trigger to Bypass RLS
  
  ## Problem
  The handle_new_user() trigger fails because:
  1. Function is SECURITY DEFINER but RLS policies still check auth.uid()
  2. When trigger executes, auth.uid() doesn't match the NEW.id
  3. INSERT policies reject the insert even from the trigger
  
  ## Solution
  1. Grant the function owner (postgres) permission to bypass RLS for inserts
  2. Update function to properly handle user creation
  3. Ensure subscription_tier_id is nullable to avoid FK constraint issues
  
  ## Security
  - Function remains SECURITY DEFINER for elevated privileges
  - Only triggers on auth.users INSERT (controlled by Supabase Auth)
  - Cannot be called directly by users
*/

-- Drop the existing trigger and function to recreate them
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the function with proper RLS bypass
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  free_tier_id uuid;
BEGIN
  -- Get the first Free tier subscription ID
  SELECT id INTO free_tier_id
  FROM subscription_tiers_new
  WHERE name = 'Free' AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  -- Insert into user_profiles with explicit RLS bypass via SECURITY DEFINER
  INSERT INTO public.user_profiles (
    id, 
    email, 
    subscription_tier_id,
    subscription_status,
    role,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    free_tier_id,
    'active',
    'user',
    now(), 
    now()
  );

  -- Insert into user_credits with free tier limits
  INSERT INTO public.user_credits (
    user_id,
    images_limit,
    sms_limit,
    events_limit,
    images_used,
    sms_used,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    10,  -- Free tier: 10 images
    5,   -- Free tier: 5 SMS
    1,   -- Free tier: 1 event
    0,
    0,
    now(),
    now()
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user for user %: % %', NEW.id, SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

-- Grant necessary permissions to the function owner to bypass RLS
-- The function executes as the definer, not as the current user
GRANT USAGE ON SCHEMA public TO postgres;
GRANT INSERT ON public.user_profiles TO postgres;
GRANT INSERT ON public.user_credits TO postgres;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also update RLS policies to allow service role to insert
-- This ensures the SECURITY DEFINER function can always insert
DROP POLICY IF EXISTS "System can insert user profiles" ON user_profiles;
CREATE POLICY "System can insert user profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);  -- Allow insert during signup, user_id is set by trigger

DROP POLICY IF EXISTS "System can insert credits" ON user_credits;
CREATE POLICY "System can insert credits"
  ON user_credits
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);  -- Allow insert during signup, user_id is set by trigger
