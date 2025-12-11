/*
  # Add Dropbox Access Token to Tenants Table

  1. Changes
    - Add `dropbox_access_token` column to `tenants` table to store OAuth access token
    - This allows tenants to authenticate with Dropbox API for file uploads

  2. Security
    - Column is text type to store the access token securely
    - No default value as this must be explicitly configured by the tenant
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'dropbox_access_token'
  ) THEN
    ALTER TABLE tenants ADD COLUMN dropbox_access_token text;
  END IF;
END $$;
