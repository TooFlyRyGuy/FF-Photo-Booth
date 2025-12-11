/*
  # Fix Security and Performance Issues

  ## Changes

  1. **Add Missing Foreign Key Indexes**
     - Add index on `event_prompts.prompt_id`
     - Add index on `generated_images.tenant_id`
     - Add index on `sms_logs.image_id`
     - Add index on `sms_logs.tenant_id`
     - Add index on `usage_logs.tenant_id`
     - Add index on `users.tenant_id`

  2. **Optimize RLS Policies**
     - Wrap all `auth.uid()` calls with `(select auth.uid())` for better performance
     - This prevents re-evaluation of the function for each row

  3. **Remove Unused Indexes**
     - Drop `idx_events_created_by` (unused)
     - Drop `idx_generated_images_prompt_id` (unused)

  4. **Fix Function Search Path**
     - Update `increment_image_usage` function
     - Update `increment_sms_usage` function
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_event_prompts_prompt_id ON event_prompts(prompt_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_tenant_id ON generated_images(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_image_id ON sms_logs(image_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_tenant_id ON sms_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_id ON usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- =====================================================
-- 2. REMOVE UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_events_created_by;
DROP INDEX IF EXISTS idx_generated_images_prompt_id;

-- =====================================================
-- 3. OPTIMIZE RLS POLICIES - TENANTS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view demo tenant or tenants with active events" ON tenants;
DROP POLICY IF EXISTS "Owners can update their tenant" ON tenants;

CREATE POLICY "Anyone can view demo tenant or tenants with active events"
  ON tenants FOR SELECT
  TO public
  USING (
    id = '00000000-0000-0000-0000-000000000001'::uuid
    OR EXISTS (
      SELECT 1 FROM events
      WHERE events.tenant_id = tenants.id
      AND events.is_active = true
    )
    OR ((select auth.uid()) IS NOT NULL AND id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    ))
  );

CREATE POLICY "Owners can update their tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (id IN (
    SELECT tenant_id FROM users WHERE id = (select auth.uid()) AND role = 'owner'
  ))
  WITH CHECK (id IN (
    SELECT tenant_id FROM users WHERE id = (select auth.uid()) AND role = 'owner'
  ));

-- =====================================================
-- 4. OPTIMIZE RLS POLICIES - SUBSCRIPTION_LIMITS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view demo tenant or active event subscription limits" ON subscription_limits;

CREATE POLICY "Anyone can view demo tenant or active event subscription limits"
  ON subscription_limits FOR SELECT
  TO public
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR EXISTS (
      SELECT 1 FROM events WHERE events.tenant_id = subscription_limits.tenant_id AND events.is_active = true
    )
    OR ((select auth.uid()) IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    ))
  );

-- =====================================================
-- 5. OPTIMIZE RLS POLICIES - PROMPTS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Admins can delete own tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Anyone can view global or demo tenant or own tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Users can insert own tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Users can update own tenant prompts" ON prompts;

CREATE POLICY "Anyone can view global or demo tenant or own tenant prompts"
  ON prompts FOR SELECT
  TO public
  USING (
    tenant_id IS NULL
    OR tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR ((select auth.uid()) IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    ))
  );

CREATE POLICY "Users can insert own tenant prompts"
  ON prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own tenant prompts"
  ON prompts FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    )
  );

CREATE POLICY "Admins can delete own tenant prompts"
  ON prompts FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid()) AND role = ANY(ARRAY['owner', 'admin'])
    )
  );

-- =====================================================
-- 6. OPTIMIZE RLS POLICIES - EVENTS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Admins can delete own tenant events" ON events;
DROP POLICY IF EXISTS "Anyone can view demo tenant events or events by passcode" ON events;
DROP POLICY IF EXISTS "Users can insert own tenant events" ON events;
DROP POLICY IF EXISTS "Users can update own tenant events" ON events;

CREATE POLICY "Anyone can view demo tenant events or events by passcode"
  ON events FOR SELECT
  TO public
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR (is_active = true AND passcode IS NOT NULL)
    OR ((select auth.uid()) IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    ))
  );

CREATE POLICY "Users can insert own tenant events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own tenant events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    )
  );

CREATE POLICY "Admins can delete own tenant events"
  ON events FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid()) AND role = ANY(ARRAY['owner', 'admin'])
    )
  );

-- =====================================================
-- 7. OPTIMIZE RLS POLICIES - EVENT_PROMPTS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view demo tenant or active event prompts" ON event_prompts;
DROP POLICY IF EXISTS "Users can delete own tenant event prompts" ON event_prompts;
DROP POLICY IF EXISTS "Users can insert own tenant event prompts" ON event_prompts;

CREATE POLICY "Anyone can view demo tenant or active event prompts"
  ON event_prompts FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_prompts.event_id 
      AND (
        events.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
        OR events.is_active = true
        OR ((select auth.uid()) IS NOT NULL AND events.tenant_id IN (
          SELECT tenant_id FROM users WHERE id = (select auth.uid())
        ))
      )
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
        SELECT tenant_id FROM users WHERE id = (select auth.uid())
      )
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
        SELECT tenant_id FROM users WHERE id = (select auth.uid())
      )
    )
  );

-- =====================================================
-- 8. OPTIMIZE RLS POLICIES - GENERATED_IMAGES TABLE
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view demo tenant or active event generated images" ON generated_images;
DROP POLICY IF EXISTS "Users can insert own tenant generated images" ON generated_images;
DROP POLICY IF EXISTS "Users can update own tenant generated images" ON generated_images;

CREATE POLICY "Anyone can view demo tenant or active event generated images"
  ON generated_images FOR SELECT
  TO public
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR EXISTS (
      SELECT 1 FROM events WHERE events.id = generated_images.event_id AND events.is_active = true
    )
    OR ((select auth.uid()) IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    ))
  );

CREATE POLICY "Users can insert own tenant generated images"
  ON generated_images FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own tenant generated images"
  ON generated_images FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    )
  );

-- =====================================================
-- 9. FIX FUNCTION SEARCH PATH
-- =====================================================

-- Recreate increment_image_usage function with stable search_path
CREATE OR REPLACE FUNCTION increment_image_usage(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO usage_logs (tenant_id, resource_type, quantity)
  VALUES (p_tenant_id, 'images', 1)
  ON CONFLICT (tenant_id, resource_type, date)
  DO UPDATE SET quantity = usage_logs.quantity + 1;
END;
$$;

-- Recreate increment_sms_usage function with stable search_path
CREATE OR REPLACE FUNCTION increment_sms_usage(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO usage_logs (tenant_id, resource_type, quantity)
  VALUES (p_tenant_id, 'sms', 1)
  ON CONFLICT (tenant_id, resource_type, date)
  DO UPDATE SET quantity = usage_logs.quantity + 1;
END;
$$;
