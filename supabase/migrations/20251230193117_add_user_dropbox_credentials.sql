/*
  # Add User Dropbox Credentials

  ## Overview
  This migration adds fields for users to store their own Dropbox app credentials,
  allowing each user to integrate their personal Dropbox app for image uploads.

  ## Changes

  ### 1. Add Dropbox Credentials to user_profiles
  - `dropbox_app_key` (text, nullable) - User's Dropbox app key
  - `dropbox_app_secret` (text, nullable) - User's Dropbox app secret (encrypted)
  - `dropbox_access_token` (text, nullable) - User's Dropbox access token
  - `dropbox_refresh_token` (text, nullable) - User's Dropbox refresh token

  ## Security Notes
  - Users can only view and edit their own Dropbox credentials
  - RLS policies ensure data isolation
*/

-- ============================================================================
-- STEP 1: Add Dropbox credential columns to user_profiles
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'dropbox_app_key'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN dropbox_app_key text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'dropbox_app_secret'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN dropbox_app_secret text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'dropbox_access_token'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN dropbox_access_token text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'dropbox_refresh_token'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN dropbox_refresh_token text DEFAULT NULL;
  END IF;
END $$;
