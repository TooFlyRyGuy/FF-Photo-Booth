/*
  # Allow Public Access to Demo Tenant Prompts

  1. Changes
    - Drop existing INSERT policy for prompts that requires authentication
    - Create new INSERT policy that allows public access for demo tenant
    - Demo tenant (00000000-0000-0000-0000-000000000000) can be accessed without auth
    - Authenticated users can still insert to their own tenant

  2. Security
    - Public users can only insert to demo tenant
    - Authenticated users can insert to demo tenant OR their own tenant
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can insert demo tenant or own tenant prompts" ON prompts;

-- Create new policy allowing public access for demo tenant
CREATE POLICY "Allow public and authenticated prompt inserts"
  ON prompts
  FOR INSERT
  TO public
  WITH CHECK (
    -- Allow demo tenant for everyone (public and authenticated)
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid 
    OR 
    -- Allow authenticated users to insert to their own tenant
    (
      auth.uid() IS NOT NULL 
      AND tenant_id IN (
        SELECT tenant_id 
        FROM users 
        WHERE id = auth.uid()
      )
    )
  );
