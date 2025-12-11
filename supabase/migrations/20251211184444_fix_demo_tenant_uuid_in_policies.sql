/*
  # Fix Demo Tenant UUID in RLS Policies

  1. Changes
    - Update all RLS policies to use correct demo tenant ID
    - Demo tenant ID is 00000000-0000-0000-0000-000000000001 (ending in 1, not 0)
    - Affects policies on: tenants, events, event_prompts, prompts, generated_images

  2. Security
    - Maintains same security model with correct UUID
*/

-- Fix tenants table policies
DROP POLICY IF EXISTS "Anyone can view demo tenant" ON tenants;
CREATE POLICY "Anyone can view demo tenant"
  ON tenants FOR SELECT
  TO public
  USING (id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS "Anyone can update demo tenant" ON tenants;
CREATE POLICY "Anyone can update demo tenant"
  ON tenants FOR UPDATE
  TO public
  USING (id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Fix events table policy
DROP POLICY IF EXISTS "Anyone can view demo tenant or own tenant events" ON events;
CREATE POLICY "Anyone can view demo tenant or own tenant events"
  ON events FOR SELECT
  TO public
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
    OR (
      auth.uid() IS NOT NULL 
      AND tenant_id IN (
        SELECT tenant_id 
        FROM users 
        WHERE id = auth.uid()
      )
    )
  );

-- Fix event_prompts table policy
DROP POLICY IF EXISTS "Anyone can view demo tenant or own tenant event prompts" ON event_prompts;
CREATE POLICY "Anyone can view demo tenant or own tenant event prompts"
  ON event_prompts FOR SELECT
  TO public
  USING (
    event_id IN (
      SELECT id 
      FROM events 
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
    OR (
      auth.uid() IS NOT NULL 
      AND event_id IN (
        SELECT e.id 
        FROM events e
        JOIN users u ON u.tenant_id = e.tenant_id
        WHERE u.id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert demo tenant or own tenant event prompts" ON event_prompts;
CREATE POLICY "Users can insert demo tenant or own tenant event prompts"
  ON event_prompts FOR INSERT
  TO public
  WITH CHECK (
    event_id IN (
      SELECT id 
      FROM events 
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
    OR (
      auth.uid() IS NOT NULL 
      AND event_id IN (
        SELECT e.id 
        FROM events e
        JOIN users u ON u.tenant_id = e.tenant_id
        WHERE u.id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update demo tenant or own tenant event prompts" ON event_prompts;
CREATE POLICY "Users can update demo tenant or own tenant event prompts"
  ON event_prompts FOR UPDATE
  TO public
  USING (
    event_id IN (
      SELECT id 
      FROM events 
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
    OR (
      auth.uid() IS NOT NULL 
      AND event_id IN (
        SELECT e.id 
        FROM events e
        JOIN users u ON u.tenant_id = e.tenant_id
        WHERE u.id = auth.uid()
      )
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id 
      FROM events 
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
    OR (
      auth.uid() IS NOT NULL 
      AND event_id IN (
        SELECT e.id 
        FROM events e
        JOIN users u ON u.tenant_id = e.tenant_id
        WHERE u.id = auth.uid()
      )
    )
  );

-- Fix prompts table policies
DROP POLICY IF EXISTS "Anyone can view global or demo tenant or own tenant prompts" ON prompts;
CREATE POLICY "Anyone can view global or demo tenant or own tenant prompts"
  ON prompts FOR SELECT
  TO public
  USING (
    tenant_id IS NULL 
    OR tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
    OR (
      auth.uid() IS NOT NULL 
      AND tenant_id IN (
        SELECT tenant_id 
        FROM users 
        WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Allow public and authenticated prompt inserts" ON prompts;
CREATE POLICY "Allow public and authenticated prompt inserts"
  ON prompts FOR INSERT
  TO public
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
    OR (
      auth.uid() IS NOT NULL 
      AND tenant_id IN (
        SELECT tenant_id 
        FROM users 
        WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update demo tenant or own tenant prompts" ON prompts;
CREATE POLICY "Users can update demo tenant or own tenant prompts"
  ON prompts FOR UPDATE
  TO public
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
    OR (
      auth.uid() IS NOT NULL 
      AND tenant_id IN (
        SELECT tenant_id 
        FROM users 
        WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
    OR (
      auth.uid() IS NOT NULL 
      AND tenant_id IN (
        SELECT tenant_id 
        FROM users 
        WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Admins can delete demo tenant or own tenant prompts" ON prompts;
CREATE POLICY "Admins can delete demo tenant or own tenant prompts"
  ON prompts FOR DELETE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
    OR tenant_id IN (
      SELECT tenant_id 
      FROM users 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Fix generated_images table policy
DROP POLICY IF EXISTS "Anyone can insert demo tenant or own tenant generated images" ON generated_images;
CREATE POLICY "Anyone can insert demo tenant or own tenant generated images"
  ON generated_images FOR INSERT
  TO public
  WITH CHECK (
    event_id IN (
      SELECT id 
      FROM events 
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
    OR (
      auth.uid() IS NOT NULL 
      AND event_id IN (
        SELECT e.id 
        FROM events e
        JOIN users u ON u.tenant_id = e.tenant_id
        WHERE u.id = auth.uid()
      )
    )
  );
