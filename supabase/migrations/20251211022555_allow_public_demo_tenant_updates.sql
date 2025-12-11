/*
  # Allow Public Updates to Demo Tenant

  1. Changes
    - Add RLS policy to allow public (anonymous) users to update the demo tenant
    - This enables the Settings page to work without authentication

  2. Security
    - Only applies to the specific demo tenant ID
    - Does not affect other tenants which still require authentication
*/

CREATE POLICY "Public can update demo tenant settings"
  ON tenants
  FOR UPDATE
  TO public
  USING (id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid);
