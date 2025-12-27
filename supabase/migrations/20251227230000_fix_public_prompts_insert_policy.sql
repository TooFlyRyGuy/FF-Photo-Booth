/*
  # Fix Public Prompts Insert Policy

  1. Changes
    - Update the INSERT policy for prompts to allow creating public prompts (tenant_id IS NULL)
    - Update the UPDATE policy for prompts to allow updating public prompts (tenant_id IS NULL)
    - Ensure authenticated users can create and edit public prompts
  
  2. Security
    - Only authenticated users can create/edit public prompts
    - Maintains existing security for tenant-specific prompts
*/

DROP POLICY IF EXISTS "Users can insert prompts" ON prompts;
CREATE POLICY "Users can insert prompts"
  ON prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IS NULL
    OR tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update prompts" ON prompts;
CREATE POLICY "Users can update prompts"
  ON prompts FOR UPDATE
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IS NULL
    OR tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  );
