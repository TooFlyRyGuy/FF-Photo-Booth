/*
  # Fix Deletion of Public Prompts

  1. Problem
    - Users cannot delete prompts they marked as public (tenant_id = NULL)
    - The current delete policy only allows deletion of prompts in user's tenant
    - When users mark prompts as public, they lose ability to manage them

  2. Solution
    - Update delete policy to allow users to delete:
      * Prompts from their own tenant (existing behavior)
      * Public prompts (tenant_id IS NULL)

  3. Rationale
    - Users who create prompts should be able to delete them even after marking public
    - Insert/update policies already prevent unauthorized modifications
    - This maintains user control over content they created
*/

-- Drop the existing restrictive delete policy
DROP POLICY IF EXISTS "Users can delete prompts" ON prompts;

-- Create new policy that allows deletion of both tenant and public prompts
CREATE POLICY "Users can delete own and public prompts"
  ON prompts FOR DELETE
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  );
