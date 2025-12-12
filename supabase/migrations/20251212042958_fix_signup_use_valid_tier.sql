/*
  # Fix Signup - Use Valid Tier Value

  ## Overview
  Fixes the handle_new_user() trigger to use 'STARTER' instead of 'FREE'
  since the tenants table CHECK constraint only allows 'STARTER', 'PRO', 
  or 'ENTERPRISE'.

  ## Changes
  - Changes tier from 'FREE' to 'STARTER' for new tenants
  - Changes subscription_tier from 'FREE' to 'STARTER' for new user profiles

  ## Important Notes
  - This resolves the CHECK constraint violation causing signup failures
  - STARTER tier is the appropriate free tier for new users
*/

-- Fix the trigger function to use valid tier values
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_tenant_id uuid;
  user_full_name text;
BEGIN
  -- Generate a new tenant ID
  new_tenant_id := gen_random_uuid();
  
  -- Extract full name safely
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'User'
  );

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
    user_full_name,
    'STARTER',
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
    user_full_name || '''s Account',
    'STARTER',
    NEW.id,
    false,
    true,
    false,
    false,
    false
  );

  -- Create subscription limits for the new tenant (starter tier)
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
    RAISE LOG 'Error in handle_new_user for user %: % %', NEW.id, SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

-- Ensure proper ownership
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
