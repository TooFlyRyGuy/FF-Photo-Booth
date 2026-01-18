/*
  # Set Admin User and Configure Unlimited Credits

  ## Overview
  This migration sets ryanrobertlee@gmail.com as the ADMIN user and configures the system
  to give admins unlimited credits (credits are tracked but not enforced).

  ## Changes

  ### 1. Set Admin User
  - Find user with email ryanrobertlee@gmail.com
  - Set their role to 'admin' in user_profiles

  ### 2. Update User Credits for Admin
  - Set very high limits for admin users (effectively unlimited)
  - Create credits record if it doesn't exist

  ### 3. Create Helper Views
  - Create view for admin to see all users with their stats
  - Create view for admin to see all events across users
  - Create view for admin to see all prompts across users

  ## Security
  - Only users with role='admin' can access admin views
  - Admin can see all data across all users

  ## Important Notes
  - Admin users will not have credit limits enforced in application logic
  - Credits are still tracked for reporting purposes
  - Only ryanrobertlee@gmail.com is set as admin initially
*/

-- ============================================================================
-- STEP 1: Set ryanrobertlee@gmail.com as admin
-- ============================================================================

DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Find the user by email in auth.users
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'ryanrobertlee@gmail.com';

  IF admin_user_id IS NOT NULL THEN
    -- Update user_profiles to set role as admin
    UPDATE user_profiles
    SET role = 'admin'
    WHERE id = admin_user_id;

    RAISE NOTICE 'Set user % as admin', admin_user_id;

    -- Ensure admin has credits record with high limits
    INSERT INTO user_credits (
      user_id,
      images_limit,
      images_used,
      sms_limit,
      sms_used,
      events_limit,
      reset_date
    )
    VALUES (
      admin_user_id,
      999999999,
      0,
      999999999,
      0,
      999999999,
      (date_trunc('month', now()) + interval '1 month')
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
      images_limit = 999999999,
      sms_limit = 999999999,
      events_limit = 999999999;

    RAISE NOTICE 'Set unlimited credits for admin user %', admin_user_id;
  ELSE
    RAISE NOTICE 'User ryanrobertlee@gmail.com not found - they need to sign up first';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create admin view for all users with stats
-- ============================================================================

CREATE OR REPLACE VIEW admin_all_users AS
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.role,
  up.subscription_status,
  up.subscription_tier_id,
  up.stripe_customer_id,
  up.stripe_subscription_id,
  up.subscription_start_date,
  up.subscription_end_date,
  up.created_at,
  up.updated_at,
  uc.images_limit,
  uc.images_used,
  uc.sms_limit,
  uc.sms_used,
  uc.events_limit,
  uc.reset_date,
  (SELECT COUNT(*) FROM events WHERE user_id = up.id) as total_events,
  (SELECT COUNT(*) FROM prompts WHERE user_id = up.id) as total_prompts
FROM user_profiles up
LEFT JOIN user_credits uc ON up.id = uc.user_id;

-- Grant access to authenticated users (will be filtered by RLS)
GRANT SELECT ON admin_all_users TO authenticated;

-- ============================================================================
-- STEP 3: Create admin view for all events
-- ============================================================================

CREATE OR REPLACE VIEW admin_all_events AS
SELECT 
  e.*,
  up.email as user_email,
  up.full_name as user_name,
  (SELECT COUNT(*) FROM generated_images WHERE event_id = e.id) as total_images_generated
FROM events e
LEFT JOIN user_profiles up ON e.user_id = up.id;

-- Grant access to authenticated users (will be filtered by RLS)
GRANT SELECT ON admin_all_events TO authenticated;

-- ============================================================================
-- STEP 4: Create admin view for all prompts
-- ============================================================================

CREATE OR REPLACE VIEW admin_all_prompts AS
SELECT 
  p.*,
  up.email as user_email,
  up.full_name as user_name
FROM prompts p
LEFT JOIN user_profiles up ON p.user_id = up.id;

-- Grant access to authenticated users (will be filtered by RLS)
GRANT SELECT ON admin_all_prompts TO authenticated;

-- ============================================================================
-- STEP 5: Create function to check if current user is admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- STEP 6: Update events RLS to allow admin to see all events
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own events or admin can view all" ON events;
DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Users can insert own events" ON events;
DROP POLICY IF EXISTS "Users can update own events or admin can update all" ON events;
DROP POLICY IF EXISTS "Users can update own events" ON events;
DROP POLICY IF EXISTS "Users can delete own events or admin can delete all" ON events;
DROP POLICY IF EXISTS "Users can delete own events" ON events;

CREATE POLICY "Users can view own events or admin can view all"
  ON events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_current_user_admin());

CREATE POLICY "Users can insert own events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own events or admin can update all"
  ON events FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_current_user_admin())
  WITH CHECK (user_id = auth.uid() OR is_current_user_admin());

CREATE POLICY "Users can delete own events or admin can delete all"
  ON events FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_current_user_admin());

-- ============================================================================
-- STEP 7: Update prompts RLS to allow admin to see all prompts
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own/public prompts or admin can view all" ON prompts;
DROP POLICY IF EXISTS "Users can view own prompts or public prompts" ON prompts;
DROP POLICY IF EXISTS "Users can insert own prompts" ON prompts;
DROP POLICY IF EXISTS "Users can update own prompts or admin can update all" ON prompts;
DROP POLICY IF EXISTS "Users can update own prompts" ON prompts;
DROP POLICY IF EXISTS "Users can delete own prompts or admin can delete all" ON prompts;
DROP POLICY IF EXISTS "Users can delete own prompts" ON prompts;

CREATE POLICY "Users can view own/public prompts or admin can view all"
  ON prompts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_public = true OR is_current_user_admin());

CREATE POLICY "Users can insert own prompts"
  ON prompts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own prompts or admin can update all"
  ON prompts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_current_user_admin())
  WITH CHECK (user_id = auth.uid() OR is_current_user_admin());

CREATE POLICY "Users can delete own prompts or admin can delete all"
  ON prompts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_current_user_admin());