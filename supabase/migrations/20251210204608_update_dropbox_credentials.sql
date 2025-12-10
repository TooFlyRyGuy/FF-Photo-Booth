/*
  # Update Dropbox Integration Settings

  1. Changes
    - Remove `dropbox_access_token` column from tenants table
    - Add `dropbox_app_key` column to tenants table
    - Add `dropbox_app_secret` column to tenants table
    
  2. Purpose
    - Switch from using personal access tokens to app key/secret authentication
    - This allows the application to programmatically manage Dropbox authentication
    - Each event will have its own folder created in Dropbox automatically
*/

-- Remove old access token column if it exists
ALTER TABLE tenants 
  DROP COLUMN IF EXISTS dropbox_access_token;

-- Add new app key and secret columns
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS dropbox_app_key text,
  ADD COLUMN IF NOT EXISTS dropbox_app_secret text;