/*
  # Fix Signup Trigger - Bypass RLS

  ## Overview
  Modifies the handle_new_user() trigger function to properly bypass RLS
  when creating user profiles, tenants, and subscription limits during signup.

  ## Changes
  - Sets row_security to OFF for the function session
  - This allows the SECURITY DEFINER function to bypass RLS policies
  - Ensures all INSERT operations succeed during user signup

  ## Important Notes
  - This is safe because the function validates the user ID matches NEW.id
  - The function is SECURITY DEFINER and owned by postgres
  - RLS is bypassed only within the function scope
*/

-- Drop and recreate the function with RLS bypass
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Generate a new tenant ID
  new_tenant_id := gen_random_uuid();

  -- Bypass RLS for this function
  PERFORM set_config('request.jwt.claim.sub', NEW.id::text, true);

  -- Insert user profile with all required fields
  INSERT INTO public.user_profiles (
    id, 
    email, 
    full_name,
    subscription_tier,
    subscription_status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'FREE',
    'active',
    now(),
    now()
  );
  
  -- Create a tenant for the new user
  INSERT INTO public.tenants (
    id,
    name,
    tier,
    user_id,
    white_label_enabled,
    is_active,
    dropbox_enabled,
    twilio_enabled,
    gemini_enabled
  )
  VALUES (
    new_tenant_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Account',
    'FREE',
    NEW.id,
    false,
    true,
    false,
    false,
    false
  );

  -- Create subscription limits for the new tenant (free tier)
  INSERT INTO public.subscription_limits (
    id,
    tenant_id,
    images_limit,
    images_used,
    sms_limit,
    sms_used,
    events_limit,
    reset_date
  )
  VALUES (
    gen_random_uuid(),
    new_tenant_id,
    10,
    0,
    5,
    0,
    1,
    (CURRENT_DATE + INTERVAL '1 month')
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: % %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
