/*
  # Fix User Signup - Proper RLS Bypass

  ## Overview
  The issue is that the trigger function runs with RLS enabled, and the policies
  check auth.uid() which is NULL during signup. We need to properly grant the
  postgres role BYPASSRLS or use a different approach.

  ## Changes
  - Removes the problematic set_config approach
  - Grants INSERT permissions directly in the function
  - Uses a simpler approach that doesn't rely on RLS policies during signup

  ## Important Notes
  - The trigger runs as SECURITY DEFINER with postgres privileges
  - This bypasses RLS policies completely during the signup process
*/

-- Recreate the function with proper privileges
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Generate a new tenant ID
  new_tenant_id := gen_random_uuid();

  -- Insert user profile with all required fields
  -- This will succeed because the function is SECURITY DEFINER
  -- and runs with superuser privileges, bypassing RLS
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
    RAISE LOG 'Error in handle_new_user for user %: % %', NEW.id, SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

-- Grant necessary permissions to the postgres role
GRANT INSERT ON public.user_profiles TO postgres;
GRANT INSERT ON public.tenants TO postgres;
GRANT INSERT ON public.subscription_limits TO postgres;

-- Ensure the function owner is postgres
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
