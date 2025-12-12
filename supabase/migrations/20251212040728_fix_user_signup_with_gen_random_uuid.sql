/*
  # Fix User Signup - Use gen_random_uuid()

  ## Overview
  Updates the trigger function to use gen_random_uuid() instead of uuid_generate_v4()
  and adds better error handling.

  ## Changes
  - Uses gen_random_uuid() which is built-in to PostgreSQL 13+
  - Adds RAISE NOTICE for debugging
  - Ensures all required fields are populated

  ## Important Notes
  - This fixes potential UUID generation issues
  - Uses PostgreSQL's native UUID generation
*/

-- Drop and recreate the function with gen_random_uuid()
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Generate a new tenant ID using gen_random_uuid()
  new_tenant_id := gen_random_uuid();

  -- Insert user profile
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
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
$$ LANGUAGE plpgsql SECURITY DEFINER;