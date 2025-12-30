/*
  # Fix User Signup Trigger - Remove Tenants Table References
  
  ## Overview
  The signup trigger is failing because it references the old `tenants` and `subscription_limits` tables
  which no longer exist. The new architecture uses `user_profiles` and `user_credits` instead.
  
  ## Changes Made
  
  ### 1. Update handle_new_user Trigger
  - Remove references to `tenants` table (doesn't exist)
  - Remove references to `subscription_limits` table (doesn't exist)
  - Insert into `user_profiles` with proper fields
  - Insert into `user_credits` with default free tier limits
  - Get free tier subscription_tier_id from subscription_tiers_new table
  
  ## Security
  - Function remains SECURITY DEFINER to bypass RLS during signup
  - Proper error handling maintained
*/

-- ============================================================================
-- Update the trigger function to use new schema
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  free_tier_id uuid;
BEGIN
  -- Get the free tier subscription ID
  SELECT id INTO free_tier_id
  FROM subscription_tiers_new
  WHERE name = 'Free'
  LIMIT 1;

  -- Insert into user_profiles
  INSERT INTO public.user_profiles (
    id, 
    email, 
    subscription_tier_id,
    subscription_status,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    free_tier_id,
    'active',
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
    sms_used
  )
  VALUES (
    NEW.id,
    10,
    5,
    1,
    0,
    0
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user for user %: % %', NEW.id, SQLERRM, SQLSTATE;
    RAISE;
END;
$$;
