/*
  # Simplify and Debug Signup Trigger

  ## Overview
  Creates a minimal trigger to debug the signup issue. This version will
  provide better error logging and handle edge cases.

  ## Changes
  - Adds extensive logging to identify exactly where the failure occurs
  - Handles NULL metadata gracefully
  - Uses explicit error messages for each step

  ## Important Notes
  - This version includes debug logging to help identify the issue
  - The function still bypasses RLS as SECURITY DEFINER
*/

-- Recreate the function with better error handling and logging
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_tenant_id uuid;
  user_full_name text;
BEGIN
  RAISE LOG 'Starting handle_new_user for user %', NEW.id;
  
  -- Generate a new tenant ID
  new_tenant_id := gen_random_uuid();
  RAISE LOG 'Generated tenant ID: %', new_tenant_id;
  
  -- Extract full name safely
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'User'
  );
  RAISE LOG 'User full name: %', user_full_name;

  -- Step 1: Insert user profile
  BEGIN
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
      'FREE',
      'active',
      now(),
      now()
    );
    RAISE LOG 'Successfully created user profile for %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE LOG 'Error creating user profile: % %', SQLERRM, SQLSTATE;
      RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
  END;
  
  -- Step 2: Create tenant
  BEGIN
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
      'FREE',
      NEW.id,
      false,
      true,
      false,
      false,
      false
    );
    RAISE LOG 'Successfully created tenant for %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE LOG 'Error creating tenant: % %', SQLERRM, SQLSTATE;
      RAISE EXCEPTION 'Failed to create tenant: %', SQLERRM;
  END;

  -- Step 3: Create subscription limits
  BEGIN
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
    RAISE LOG 'Successfully created subscription limits for %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE LOG 'Error creating subscription limits: % %', SQLERRM, SQLSTATE;
      RAISE EXCEPTION 'Failed to create subscription limits: %', SQLERRM;
  END;
  
  RAISE LOG 'Completed handle_new_user for user %', NEW.id;
  RETURN NEW;
END;
$$;

-- Ensure proper ownership
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
