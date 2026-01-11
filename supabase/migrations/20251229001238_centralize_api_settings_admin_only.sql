/*
  # Centralize API Settings - Admin Only

  ## Overview
  This migration centralizes Gemini, Twilio, and SmugMug settings as admin-only global settings.
  Users can only configure their own Dropbox accounts.

  ## Changes

  ### 1. User Settings Table
  - Keeps only Dropbox-related fields in user_settings
  - Removes Gemini, Twilio, and SmugMug fields (these are now global-only)
  
  ### 2. Global Settings
  - All Gemini, Twilio, and SmugMug settings remain in global_settings
  - Only admins can modify global_settings
  
  ### 3. User Roles
  - Add role column to user_profiles if not exists
  - Default role is 'user'
  - 'admin' role can modify global settings

  ## Security
  - Users can only modify their own Dropbox settings
  - Global settings require admin role
  - RLS policies enforce role-based access
*/

-- ============================================================================
-- STEP 1: Add role column to user_profiles if not exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN role text DEFAULT 'user' CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- ============================================================================
-- STEP 2: Update user_settings table - Keep only Dropbox fields
-- ============================================================================

-- Drop non-Dropbox columns from user_settings (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_settings'
  ) THEN
    -- Drop Twilio columns if they exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'twilio_account_sid'
    ) THEN
      ALTER TABLE user_settings DROP COLUMN twilio_account_sid CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'twilio_auth_token'
    ) THEN
      ALTER TABLE user_settings DROP COLUMN twilio_auth_token CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'twilio_phone_number'
    ) THEN
      ALTER TABLE user_settings DROP COLUMN twilio_phone_number CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'twilio_enabled'
    ) THEN
      ALTER TABLE user_settings DROP COLUMN twilio_enabled CASCADE;
    END IF;

    -- Drop Gemini columns if they exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'gemini_api_key'
    ) THEN
      ALTER TABLE user_settings DROP COLUMN gemini_api_key CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'gemini_enabled'
    ) THEN
      ALTER TABLE user_settings DROP COLUMN gemini_enabled CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'gemini_model'
    ) THEN
      ALTER TABLE user_settings DROP COLUMN gemini_model CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'gemini_resolution'
    ) THEN
      ALTER TABLE user_settings DROP COLUMN gemini_resolution CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Ensure global_settings has all necessary fields
-- ============================================================================

DO $$
BEGIN
  -- Gemini fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'gemini_api_key'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN gemini_api_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'gemini_enabled'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN gemini_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'gemini_model'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN gemini_model text DEFAULT 'gemini-3-pro-image-preview';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'gemini_resolution'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN gemini_resolution text DEFAULT '1K';
  END IF;

  -- Twilio fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'twilio_account_sid'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN twilio_account_sid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'twilio_auth_token'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN twilio_auth_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'twilio_phone_number'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN twilio_phone_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'twilio_enabled'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN twilio_enabled boolean DEFAULT false;
  END IF;

  -- Dropbox global fields (for OAuth app credentials)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'dropbox_app_key'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN dropbox_app_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'dropbox_app_secret'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN dropbox_app_secret text;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Update RLS policies for global_settings
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view global settings" ON global_settings;
DROP POLICY IF EXISTS "System users can manage global settings" ON global_settings;
DROP POLICY IF EXISTS "Admins can manage global settings" ON global_settings;
DROP POLICY IF EXISTS "Admins can read all global settings" ON global_settings;

-- New policies: Admins can read/write, regular users cannot access
CREATE POLICY "Admins can read global settings"
  ON global_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update global settings"
  ON global_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert global settings"
  ON global_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- STEP 5: Add helper function to check admin role
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin()
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
-- STEP 6: Create a singleton row for global_settings if not exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM global_settings LIMIT 1) THEN
    INSERT INTO global_settings (setting_key, setting_value)
    VALUES ('app_initialized', 'true');
  END IF;
END $$;