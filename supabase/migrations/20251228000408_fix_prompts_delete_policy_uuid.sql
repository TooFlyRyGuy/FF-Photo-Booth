/*
  # Fix Prompts DELETE Policy Demo Tenant UUID

  1. Changes
    - Update the DELETE policy for prompts table to use the correct demo tenant UUID
    - The policy was checking for '00000000-0000-0000-0000-000000000000' but the actual demo tenant is '00000000-0000-0000-0000-000000000001'
    
  2. Security
    - Maintains same security level, just fixes the UUID mismatch
    - Allows deletion of public prompts, demo tenant prompts, and own tenant's prompts
*/

-- Drop and recreate the DELETE policy with the correct UUID
DROP POLICY IF EXISTS "Users can delete own and public prompts" ON prompts;

CREATE POLICY "Users can delete own and public prompts"
  ON prompts
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IS NULL OR
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid OR
    tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  );
