/*
  # Allow Authenticated Users to Read Global Settings

  ## Overview
  This migration allows all authenticated users to read global settings (like Gemini API key)
  so they can use admin-configured services in the kiosk mode.
  Only admins can still modify global settings.

  ## Changes Made

  ### 1. RLS Policy Updates
  - Add policy allowing all authenticated users to SELECT from global_settings
  - Maintain existing policies restricting INSERT/UPDATE/DELETE to admins only

  ## Security
  - All authenticated users can read global settings (needed for kiosk functionality)
  - Only admins can modify global settings
  - Anonymous users cannot access global settings
*/

-- ============================================================================
-- Allow all authenticated users to read global settings
-- ============================================================================

-- Drop the restrictive admin-only SELECT policy
DROP POLICY IF EXISTS "Admins can read global settings" ON global_settings;

-- Create new policy allowing all authenticated users to read global settings
CREATE POLICY "Authenticated users can read global settings"
  ON global_settings FOR SELECT
  TO authenticated
  USING (true);

-- Note: INSERT, UPDATE policies remain admin-only as defined in previous migrations
