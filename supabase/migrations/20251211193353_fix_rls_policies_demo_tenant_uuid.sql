/*
  # Fix RLS Policies with Correct Demo Tenant UUID

  ## Issue
  The RLS policies were using the wrong demo tenant UUID ('...-000000' instead of '...-000001').
  This caused permission errors when unauthenticated users tried to update events.

  ## Changes
  1. Drop all existing policies
  2. Create new policies with correct demo tenant UUID: '00000000-0000-0000-0000-000000000001'

  ## Tables Affected
  - tenants
  - events
  - prompts
  - event_prompts
  - generated_images
  - subscription_limits
*/

-- ============ DROP ALL EXISTING POLICIES ============

-- Tenants
DROP POLICY IF EXISTS "Anyone can view demo tenant" ON tenants;
DROP POLICY IF EXISTS "Anyone can view demo tenant or tenants with active events" ON tenants;
DROP POLICY IF EXISTS "Anyone can update demo tenant" ON tenants;
DROP POLICY IF EXISTS "Owners can update their tenant" ON tenants;
DROP POLICY IF EXISTS "Owners can update their tenant or demo tenant" ON tenants;

-- Events
DROP POLICY IF EXISTS "Anyone can view demo tenant or own tenant events" ON events;
DROP POLICY IF EXISTS "Anyone can view demo tenant events or events by passcode" ON events;
DROP POLICY IF EXISTS "Users can insert demo tenant or own tenant events" ON events;
DROP POLICY IF EXISTS "Users can update demo tenant or own tenant events" ON events;
DROP POLICY IF EXISTS "Admins can delete demo tenant or own tenant events" ON events;

-- Prompts
DROP POLICY IF EXISTS "Anyone can view global or demo tenant or own tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Users can insert demo tenant or own tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Allow public and authenticated prompt inserts" ON prompts;
DROP POLICY IF EXISTS "Users can update demo tenant or own tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Admins can delete demo tenant or own tenant prompts" ON prompts;

-- Event Prompts
DROP POLICY IF EXISTS "Anyone can view demo tenant event prompts or own tenant event p" ON event_prompts;
DROP POLICY IF EXISTS "Anyone can view demo tenant or own tenant event prompts" ON event_prompts;
DROP POLICY IF EXISTS "Users can insert demo tenant or own tenant event prompts" ON event_prompts;
DROP POLICY IF EXISTS "Users can update demo tenant or own tenant event prompts" ON event_prompts;
DROP POLICY IF EXISTS "Users can delete demo tenant or own tenant event prompts" ON event_prompts;

-- Generated Images
DROP POLICY IF EXISTS "Anyone can view demo tenant or active event generated images" ON generated_images;
DROP POLICY IF EXISTS "Anyone can insert demo tenant or own tenant generated images" ON generated_images;
DROP POLICY IF EXISTS "Public can create generated images" ON generated_images;
DROP POLICY IF EXISTS "Users can insert demo tenant or own tenant generated images" ON generated_images;
DROP POLICY IF EXISTS "Users can update demo tenant or own tenant generated images" ON generated_images;

-- Subscription Limits
DROP POLICY IF EXISTS "Anyone can view demo tenant or active event subscription limits" ON subscription_limits;
DROP POLICY IF EXISTS "System can update subscription limits" ON subscription_limits;

-- ============ CREATE NEW POLICIES WITH CORRECT UUID ============

-- ============ TENANTS TABLE ============
CREATE POLICY "Anyone can view demo tenant or tenants with active events"
  ON tenants FOR SELECT
  USING (
    id = '00000000-0000-0000-0000-000000000001'::uuid
    OR EXISTS (
      SELECT 1 FROM events
      WHERE events.tenant_id = tenants.id
      AND events.is_active = true
    )
    OR (auth.uid() IS NOT NULL AND id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Anyone can update demo tenant"
  ON tenants FOR UPDATE
  USING (id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Owners can update their tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- ============ EVENTS TABLE ============
CREATE POLICY "Anyone can view demo tenant events or events by passcode"
  ON events FOR SELECT
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR (is_active = true AND passcode IS NOT NULL)
    OR (auth.uid() IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Anyone can insert demo tenant events"
  ON events FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Users can insert own tenant events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Anyone can update demo tenant events"
  ON events FOR UPDATE
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Users can update own tenant events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Anyone can delete demo tenant events"
  ON events FOR DELETE
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Admins can delete own tenant events"
  ON events FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============ PROMPTS TABLE ============
CREATE POLICY "Anyone can view global or demo tenant or own tenant prompts"
  ON prompts FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR (auth.uid() IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Anyone can insert demo tenant prompts"
  ON prompts FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Users can insert own tenant prompts"
  ON prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Anyone can update demo tenant prompts"
  ON prompts FOR UPDATE
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Users can update own tenant prompts"
  ON prompts FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Anyone can delete demo tenant prompts"
  ON prompts FOR DELETE
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Admins can delete own tenant prompts"
  ON prompts FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============ EVENT_PROMPTS TABLE ============
CREATE POLICY "Anyone can view demo tenant or active event prompts"
  ON event_prompts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND (
        events.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
        OR events.is_active = true
        OR (auth.uid() IS NOT NULL AND events.tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        ))
      )
    )
  );

CREATE POLICY "Anyone can insert demo tenant event prompts"
  ON event_prompts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND events.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

CREATE POLICY "Users can insert own tenant event prompts"
  ON event_prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND events.tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Anyone can delete demo tenant event prompts"
  ON event_prompts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND events.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

CREATE POLICY "Users can delete own tenant event prompts"
  ON event_prompts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND events.tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- ============ GENERATED_IMAGES TABLE ============
CREATE POLICY "Anyone can view demo tenant or active event generated images"
  ON generated_images FOR SELECT
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR EXISTS (
      SELECT 1 FROM events
      WHERE events.id = generated_images.event_id
      AND events.is_active = true
    )
    OR (auth.uid() IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Anyone can insert demo tenant generated images"
  ON generated_images FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Users can insert own tenant generated images"
  ON generated_images FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Anyone can update demo tenant generated images"
  ON generated_images FOR UPDATE
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Users can update own tenant generated images"
  ON generated_images FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- ============ SUBSCRIPTION_LIMITS TABLE ============
CREATE POLICY "Anyone can view demo tenant or active event subscription limits"
  ON subscription_limits FOR SELECT
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR EXISTS (
      SELECT 1 FROM events
      WHERE events.tenant_id = subscription_limits.tenant_id
      AND events.is_active = true
    )
    OR (auth.uid() IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    ))
  );