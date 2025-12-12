/*
  # Fix Prompts Insert Policy

  1. Changes
    - Drop incorrect INSERT policy that references users.tenant_id
    - Create correct INSERT policy that uses tenants.user_id relationship
    - Fix UPDATE and DELETE policies to use correct table relationship
  
  2. Security
    - Authenticated users can insert prompts for their own tenant
    - Uses correct tenants.user_id relationship instead of non-existent users.tenant_id
*/

-- Drop the incorrect policies
DROP POLICY IF EXISTS "Users can insert own tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Users can update own tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Admins can delete own tenant prompts" ON prompts;

-- Create correct INSERT policy using tenants.user_id relationship
CREATE POLICY "Users can insert own tenant prompts"
  ON prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants 
      WHERE user_id = auth.uid()
    )
  );

-- Create correct UPDATE policy
CREATE POLICY "Users can update own tenant prompts"
  ON prompts
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants 
      WHERE user_id = auth.uid()
    )
  );

-- Create correct DELETE policy
CREATE POLICY "Users can delete own tenant prompts"
  ON prompts
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants 
      WHERE user_id = auth.uid()
    )
  );
