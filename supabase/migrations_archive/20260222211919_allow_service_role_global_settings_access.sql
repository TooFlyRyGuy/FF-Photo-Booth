/*
  # Allow Service Role to Access Global Settings
  
  Adds a policy that allows the service_role to read from global_settings table.
  This is needed for edge functions that need to access sensitive configuration like API keys.
  
  Changes:
  1. Add SELECT policy for service_role on global_settings table
  
  Security:
  - Only service_role can access (edge functions use this role)
  - Regular users still go through the restrictive RLS policies
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Service role can read all global settings" ON global_settings;

-- Create policy for service_role to access global_settings
CREATE POLICY "Service role can read all global settings"
  ON global_settings
  FOR SELECT
  TO service_role
  USING (true);

COMMENT ON POLICY "Service role can read all global settings" ON global_settings IS 'Allows edge functions (using service_role) to access global settings including sensitive API keys';
