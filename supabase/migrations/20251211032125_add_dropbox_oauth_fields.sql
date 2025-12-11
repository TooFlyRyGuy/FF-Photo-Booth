/*
  # Add Dropbox OAuth Support

  1. Changes
    - Add `dropbox_refresh_token` column to store OAuth refresh token
    - Add `dropbox_token_expires_at` column to track token expiration
    - Rename `dropbox_access_token` usage for OAuth access tokens
    
  2. Purpose
    - Enable proper OAuth 2.0 flow for Dropbox integration
    - Allow automatic token refresh when access tokens expire
    - Store refresh token securely for long-term access
    - Track token expiration to know when to refresh
    
  3. Security
    - All token fields are text type for secure storage
    - No default values - tokens must be obtained through OAuth flow
    - Tokens are never exposed to client-side code directly
*/

DO $$
BEGIN
  -- Add refresh token column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'dropbox_refresh_token'
  ) THEN
    ALTER TABLE tenants ADD COLUMN dropbox_refresh_token text;
  END IF;

  -- Add token expiration column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'dropbox_token_expires_at'
  ) THEN
    ALTER TABLE tenants ADD COLUMN dropbox_token_expires_at timestamptz;
  END IF;
END $$;