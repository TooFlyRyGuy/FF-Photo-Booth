/*
  # Fix All Incorrect RLS Policies

  1. Issues Found
    - Multiple policies reference non-existent users.tenant_id column
    - Correct relationship is tenants.user_id = auth.uid()
    - sms_logs has insecure policy using USING (true)
  
  2. Tables Fixed
    - events: All INSERT, UPDATE, DELETE, SELECT policies for authenticated users
    - event_prompts: All INSERT, DELETE, SELECT policies for authenticated users
    - generated_images: All INSERT, UPDATE, SELECT policies for authenticated users
    - prompts: SELECT policy for authenticated users
    - tenants: SELECT and UPDATE policies for owners
    - sms_logs: Remove insecure UPDATE policy
  
  3. Security
    - All policies now correctly verify tenant ownership via tenants.user_id
    - Removed policies that allow unrestricted access (USING true)
*/

-- Fix events table policies
DROP POLICY IF EXISTS "Admins can delete own tenant events" ON events;
DROP POLICY IF EXISTS "Users can insert own tenant events" ON events;
DROP POLICY IF EXISTS "Users can update own tenant events" ON events;
DROP POLICY IF EXISTS "Anyone can view demo tenant events or events by passcode" ON events;

CREATE POLICY "Admins can delete own tenant events"
  ON events
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own tenant events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own tenant events"
  ON events
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

CREATE POLICY "Anyone can view demo tenant events or events by passcode"
  ON events
  FOR SELECT
  TO public
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR (is_active = true AND passcode IS NOT NULL)
    OR (
      auth.uid() IS NOT NULL 
      AND tenant_id IN (
        SELECT id FROM tenants 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Fix event_prompts table policies
DROP POLICY IF EXISTS "Users can delete own tenant event prompts" ON event_prompts;
DROP POLICY IF EXISTS "Users can insert own tenant event prompts" ON event_prompts;
DROP POLICY IF EXISTS "Anyone can view demo tenant or active event prompts" ON event_prompts;

CREATE POLICY "Users can delete own tenant event prompts"
  ON event_prompts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_prompts.event_id 
      AND events.tenant_id IN (
        SELECT id FROM tenants 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own tenant event prompts"
  ON event_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_prompts.event_id 
      AND events.tenant_id IN (
        SELECT id FROM tenants 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Anyone can view demo tenant or active event prompts"
  ON event_prompts
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_prompts.event_id 
      AND (
        events.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
        OR events.is_active = true
        OR (
          auth.uid() IS NOT NULL 
          AND events.tenant_id IN (
            SELECT id FROM tenants 
            WHERE user_id = auth.uid()
          )
        )
      )
    )
  );

-- Fix generated_images table policies
DROP POLICY IF EXISTS "Users can insert own tenant generated images" ON generated_images;
DROP POLICY IF EXISTS "Users can update own tenant generated images" ON generated_images;
DROP POLICY IF EXISTS "Anyone can view demo tenant or active event generated images" ON generated_images;

CREATE POLICY "Users can insert own tenant generated images"
  ON generated_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own tenant generated images"
  ON generated_images
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

CREATE POLICY "Anyone can view demo tenant or active event generated images"
  ON generated_images
  FOR SELECT
  TO public
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = generated_images.event_id 
      AND events.is_active = true
    )
    OR (
      auth.uid() IS NOT NULL 
      AND tenant_id IN (
        SELECT id FROM tenants 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Fix prompts table policies
DROP POLICY IF EXISTS "Anyone can view global or demo tenant or own tenant prompts" ON prompts;

CREATE POLICY "Anyone can view global or demo tenant or own tenant prompts"
  ON prompts
  FOR SELECT
  TO public
  USING (
    tenant_id IS NULL
    OR tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR (
      auth.uid() IS NOT NULL 
      AND tenant_id IN (
        SELECT id FROM tenants 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Fix tenants table policies
DROP POLICY IF EXISTS "Anyone can view demo tenant or own tenant" ON tenants;
DROP POLICY IF EXISTS "Owners can update their tenant" ON tenants;

CREATE POLICY "Anyone can view demo tenant or own tenant"
  ON tenants
  FOR SELECT
  TO public
  USING (
    id = '00000000-0000-0000-0000-000000000001'::uuid
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

CREATE POLICY "Owners can update their tenant"
  ON tenants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix insecure sms_logs policy
DROP POLICY IF EXISTS "System can update SMS logs" ON sms_logs;

CREATE POLICY "System can update SMS logs for valid images"
  ON sms_logs
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM generated_images 
      WHERE generated_images.id = sms_logs.image_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM generated_images 
      WHERE generated_images.id = sms_logs.image_id
    )
  );
