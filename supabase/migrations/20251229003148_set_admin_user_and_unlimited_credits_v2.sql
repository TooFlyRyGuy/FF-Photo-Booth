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

  ### 3. Create Admin Helper Function
  - Create is_current_user_admin() function for RLS policies

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
-- STEP 2-4: Admin views (removed - these are dropped in later migrations)
-- ============================================================================
-- These view creation statements have been removed as they reference columns
-- that no longer exist after schema refactoring. The views are properly
-- removed in migration 20260119041107_remove_security_definer_admin_views.sql

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