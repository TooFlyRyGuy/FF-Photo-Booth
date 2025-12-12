/*
  # Fix User Signup - Add Subscription Limits

  ## Overview
  Updates the trigger function to also create subscription limits for new users.
  The previous version was missing the subscription_limits table entry.

  ## Changes
  - Updates `handle_new_user()` function to create subscription_limits entry
  - Sets free tier limits: 10 images, 5 SMS, 1 event
  - Ensures all new users have proper usage tracking

  ## Important Notes
  - This fixes the 500 error when creating new users
  - All new users will start with free tier limits
*/

-- Drop and recreate the function with subscription limits
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || '''s Account',
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
    uuid_generate_v4(),
    new_tenant_id,
    10,
    0,
    5,
    0,
    1,
    (CURRENT_DATE + INTERVAL '1 month')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;