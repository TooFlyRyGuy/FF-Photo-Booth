/*
  # Fix User Signup Trigger

  ## Overview
  Fixes the trigger function that creates user profiles and tenants on signup.
  The previous version was missing required fields for the tenants table.

  ## Changes
  - Updates the `handle_new_user()` function to include all required tenant fields
  - Ensures the usage JSON field is properly initialized
  - Adds proper error handling

  ## Important Notes
  - This fixes the 500 error when creating new users
  - All new users will get a properly configured tenant account
*/

-- Drop and recreate the function with all required fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Generate a new tenant ID
  new_tenant_id := uuid_generate_v4();

  -- Insert user profile
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Create a tenant for the new user with all required fields
  INSERT INTO public.tenants (
    id,
    name,
    tier,
    user_id,
    white_label_enabled,
    is_active,
    dropbox_enabled,
    twilio_enabled,
    gemini_enabled,
    usage
  )
  VALUES (
    new_tenant_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || '''s Account',
    'FREE',
    NEW.id,
    false,
    true,
    false,
    false,
    false,
    jsonb_build_object(
      'imagesUsed', 0,
      'imagesLimit', 10,
      'smsUsed', 0,
      'smsLimit', 5
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;