/*
  # Create Public View for Non-Sensitive Global Settings

  ## Overview
  This migration creates a secure view that exposes only non-sensitive global settings to authenticated users, while keeping API keys and secrets hidden.

  ## Changes Made
  
  1. **Create public_global_settings View**
     - Exposes only non-sensitive configuration fields
     - Available to all authenticated users for reading
     - Does not expose any API keys or OAuth tokens
  
  2. **Non-Sensitive Fields Included**
     - gemini_enabled, gemini_model, gemini_resolution
     - twilio_enabled, twilio_phone_number
     - smugmug_user_nickname, smugmug_connection_status, smugmug_default_visibility, use_smugmug_for_sms, smugmug_username
  
  3. **Sensitive Fields Excluded**
     - gemini_api_key
     - twilio_auth_token, twilio_account_sid
     - smugmug_oauth_token, smugmug_oauth_token_secret, smugmug_request_token_secret
     - dropbox_app_secret, dropbox_app_key
  
  ## Security Impact
  Authenticated users can now check if features are enabled and get configuration settings without exposing any secrets or API keys.
*/

-- Create a view that only exposes non-sensitive global settings
CREATE OR REPLACE VIEW public_global_settings AS
SELECT
  id,
  singleton_id,
  
  -- Gemini settings (non-sensitive)
  gemini_enabled,
  gemini_model,
  gemini_resolution,
  
  -- Twilio settings (non-sensitive)
  twilio_enabled,
  twilio_phone_number,
  
  -- SmugMug settings (non-sensitive)
  smugmug_user_nickname,
  smugmug_connection_status,
  smugmug_default_visibility,
  use_smugmug_for_sms,
  smugmug_username,
  smugmug_last_auth_date,
  
  -- Timestamps
  created_at,
  updated_at
FROM global_settings;

-- Grant SELECT access to authenticated users on the view
GRANT SELECT ON public_global_settings TO authenticated;

-- Add comment to the view
COMMENT ON VIEW public_global_settings IS 'Secure view exposing only non-sensitive global configuration settings to authenticated users';
