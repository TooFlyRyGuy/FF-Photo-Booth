/*
  # Fix User Signup - Add Missing Required Fields

  ## Overview
  Fixes the handle_new_user() trigger function to include all required fields
  for the user_profiles table.

  ## Changes
  - Adds subscription_tier (defaults to 'FREE')
  - Adds subscription_status (defaults to 'active')
  - Adds created_at (defaults to now())
  - Adds updated_at (defaults to now())

  ## Important Notes
  - This fixes the "Database error saving new user" issue
  - All NOT NULL fields are now properly populated
*/

-- Fix the trigger function to include all required fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Generate a new tenant ID using gen_random_uuid()
  new_tenant_id := gen_random_uuid();

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
$$ LANGUAGE plpgsql SECURITY DEFINER;
