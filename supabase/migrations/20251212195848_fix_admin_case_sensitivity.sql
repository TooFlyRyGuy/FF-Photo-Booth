/*
  # Fix Admin Case Sensitivity

  1. Changes
    - Update global_settings RLS policies to check for 'ADMIN' (uppercase) instead of 'admin' (lowercase)
    - This matches the actual subscription_tier values stored in the user_profiles table
  
  2. Security
    - Maintains admin-only access to global settings
    - Fixes case mismatch that was preventing admins from accessing settings
*/

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can view global settings" ON global_settings;
DROP POLICY IF EXISTS "Admins can insert global settings" ON global_settings;
DROP POLICY IF EXISTS "Admins can update global settings" ON global_settings;
DROP POLICY IF EXISTS "Admins can delete global settings" ON global_settings;

-- Create new admin policies with correct case
CREATE POLICY "Admins can view global settings"
  ON global_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.subscription_tier = 'ADMIN'
    )
  );

CREATE POLICY "Admins can insert global settings"
  ON global_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.subscription_tier = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update global settings"
  ON global_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.subscription_tier = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.subscription_tier = 'ADMIN'
    )
  );

CREATE POLICY "Admins can delete global settings"
  ON global_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.subscription_tier = 'ADMIN'
    )
  );
