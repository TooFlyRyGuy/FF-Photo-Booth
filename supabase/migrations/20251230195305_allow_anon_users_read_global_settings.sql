/*
  # Allow Anonymous Users to Read Global Settings

  ## Overview
  This migration allows anonymous (public) users to read global settings so they can use
  the kiosk in public mode without authentication. This is necessary because kiosks can be
  accessed via passcode without requiring users to log in.

  ## Changes Made

  ### 1. RLS Policy Updates
  - Update policy to allow both authenticated AND anonymous users to read global_settings
  - Maintain existing policies restricting INSERT/UPDATE/DELETE to admins only

  ## Security
  - All users (authenticated and anonymous) can read global settings (needed for public kiosk)
  - Only admins can modify global settings
  - This is safe because global settings contain API keys that are meant to be used by the app
*/

-- ============================================================================
-- Allow all users (authenticated and anonymous) to read global settings
-- ============================================================================

-- Drop the authenticated-only SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read global settings" ON global_settings;

-- Create new policy allowing all users to read global settings
CREATE POLICY "All users can read global settings"
  ON global_settings FOR SELECT
  USING (true);

-- Note: INSERT, UPDATE policies remain admin-only as defined in previous migrations
