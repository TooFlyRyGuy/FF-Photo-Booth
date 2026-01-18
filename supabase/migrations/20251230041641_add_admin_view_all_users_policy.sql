/*
  # Add Admin View All Users Policy

  1. Changes
    - Add RLS policy allowing admins to view all user profiles
    - Add RLS policy allowing admins to view all user credits
    - This enables the admin User Management interface to display all users

  2. Security
    - Only users with role='admin' in user_profiles can view all users
    - Regular users can still only view their own profile
*/

-- Allow admins to view all user profiles
CREATE POLICY "Admins can view all user profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Allow admins to view all user credits
CREATE POLICY "Admins can view all user credits"
  ON user_credits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Allow admins to update any user's profile
CREATE POLICY "Admins can update all user profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Allow admins to update any user's credits
CREATE POLICY "Admins can update all user credits"
  ON user_credits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );