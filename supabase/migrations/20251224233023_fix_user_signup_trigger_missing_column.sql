/*
  # Fix User Signup Trigger - Remove Invalid tenant_id Column
  
  1. Problem
    - The `handle_new_user()` trigger function attempts to insert `tenant_id` into `user_profiles`
    - The `user_profiles` table does NOT have a `tenant_id` column
    - This causes "Database error saving new user" when users sign up
  
  2. Solution
    - Update the trigger function to only insert valid columns
    - Remove the invalid tenant_id reference from the INSERT statement
  
  3. Changes
    - Fix INSERT into user_profiles to use only existing columns
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  new_tenant_id := gen_random_uuid();

  INSERT INTO public.tenants (id, user_id, name, created_at, updated_at)
  VALUES (new_tenant_id, NEW.id, COALESCE(NEW.email, 'New Tenant'), now(), now());

  INSERT INTO public.user_profiles (id, email, subscription_tier, created_at, updated_at)
  VALUES (NEW.id, NEW.email, 'free', now(), now());

  INSERT INTO public.subscription_limits (tenant_id, images_limit, sms_limit, images_used, sms_used)
  VALUES (new_tenant_id, 10, 5, 0, 0);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user for user %: % %', NEW.id, SQLERRM, SQLSTATE;
    RAISE;
END;
$$;
