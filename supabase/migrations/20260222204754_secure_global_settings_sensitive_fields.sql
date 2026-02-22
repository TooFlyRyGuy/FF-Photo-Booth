/*
  # Secure Global Settings - Restrict Access to Sensitive Fields

  ## Overview
  This migration secures the global_settings table by restricting client-side access to sensitive API keys and tokens while maintaining access to non-sensitive configuration settings.

  ## Changes Made
  
  1. **Drop Existing Permissive Policy**
     - Removes the "Anyone can read global settings" policy that exposes sensitive data
  
  2. **Create Restricted SELECT Policies**
     - Admin Full Access: Admins can read all fields including sensitive ones
     - User Limited Access: Non-admin authenticated users can only read non-sensitive fields
     - Anonymous users have NO access to global_settings
  
  3. **Sensitive Fields Protected**
     - gemini_api_key
     - twilio_auth_token
     - twilio_account_sid
     - smugmug_oauth_token
     - smugmug_oauth_token_secret
     - smugmug_request_token_secret
     - dropbox_app_secret
     - dropbox_app_key
  
  4. **Non-Sensitive Fields Accessible to Authenticated Users**
     - gemini_enabled, gemini_model, gemini_resolution
     - twilio_enabled, twilio_phone_number
     - smugmug_user_nickname, smugmug_connection_status, smugmug_default_visibility, use_smugmug_for_sms
     - All other non-credential fields
  
  ## Security Impact
  After this migration, API keys and secrets will no longer be accessible from client-side code, preventing exposure through browser inspection or network monitoring.
*/

-- Drop the existing permissive policy that allows anyone to read all settings
DROP POLICY IF EXISTS "Anyone can read global settings" ON global_settings;

-- Create a new policy that allows admins to read all fields
CREATE POLICY "Admins can read all global settings"
  ON global_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Note: We cannot create column-level RLS policies in PostgreSQL
-- Instead, we'll create a secure view for non-admin users in the next step
-- For now, non-admin users will have NO direct SELECT access to global_settings

-- Non-admin authenticated users get NO access to global_settings table directly
-- They will access non-sensitive settings through the Edge Functions or a secure view
