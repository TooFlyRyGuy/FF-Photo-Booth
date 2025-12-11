/*
  # Fix Security and Performance Issues

  ## 1. Add Missing Foreign Key Indexes
    - Add index on `events.created_by` (foreign key to users)
    - Add index on `generated_images.prompt_id` (foreign key to prompts)

  ## 2. Drop Unused Indexes
    - Remove unused indexes to reduce storage overhead and maintenance cost
    - Indexes that have not been used and are not needed for foreign keys

  ## 3. Fix Multiple Permissive Policies (Critical Security Issue)
    - Consolidate overlapping policies to prevent unintended access
    - Replace multiple permissive policies with single comprehensive policies
    - This prevents security holes where multiple policies could grant broader access than intended

  ## 4. Fix Function Security (search_path vulnerability)
    - Set explicit search_path for all functions to prevent search_path injection attacks
    - Use `SET search_path = public` for all utility functions

  ## Security Notes
    - Multiple permissive policies create OR conditions - if ANY policy grants access, user gets access
    - This can lead to privilege escalation and unintended data access
    - We consolidate policies to have clear, single access rules per role
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- Index for events.created_by foreign key
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);

-- Index for generated_images.prompt_id foreign key
CREATE INDEX IF NOT EXISTS idx_generated_images_prompt_id ON generated_images(prompt_id);

-- =====================================================
-- 2. DROP UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_users_tenant_id;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_events_is_active;
DROP INDEX IF EXISTS idx_events_event_date;
DROP INDEX IF EXISTS idx_prompts_is_active;
DROP INDEX IF EXISTS idx_prompts_category;
DROP INDEX IF EXISTS idx_event_prompts_prompt_id;
DROP INDEX IF EXISTS idx_generated_images_tenant_id;
DROP INDEX IF EXISTS idx_generated_images_status;
DROP INDEX IF EXISTS idx_generated_images_created_at;
DROP INDEX IF EXISTS idx_sms_logs_image_id;
DROP INDEX IF EXISTS idx_sms_logs_tenant_id;
DROP INDEX IF EXISTS idx_sms_logs_status;
DROP INDEX IF EXISTS idx_usage_logs_tenant_id;
DROP INDEX IF EXISTS idx_usage_logs_created_at;
DROP INDEX IF EXISTS idx_usage_logs_action_type;

-- =====================================================
-- 3. FIX MULTIPLE PERMISSIVE POLICIES
-- =====================================================

-- ============ TENANTS TABLE ============
-- Drop all existing tenant policies
DROP POLICY IF EXISTS "Public can view demo tenant" ON tenants;
DROP POLICY IF EXISTS "Public can view tenants with active events" ON tenants;
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Owners can update their tenant" ON tenants;
DROP POLICY IF EXISTS "Public can update demo tenant settings" ON tenants;

-- Create consolidated policies
CREATE POLICY "Anyone can view demo tenant or tenants with active events"
  ON tenants FOR SELECT
  USING (
    id = '00000000-0000-0000-0000-000000000000'::uuid
    OR EXISTS (
      SELECT 1 FROM events
      WHERE events.tenant_id = tenants.id
      AND events.is_active = true
    )
    OR (auth.uid() IS NOT NULL AND id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Owners can update their tenant or demo tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    id = '00000000-0000-0000-0000-000000000000'::uuid
    OR id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    id = '00000000-0000-0000-0000-000000000000'::uuid
    OR id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- ============ EVENTS TABLE ============
-- Drop all existing event policies
DROP POLICY IF EXISTS "Public can manage demo tenant events" ON events;
DROP POLICY IF EXISTS "Public can view events by passcode" ON events;
DROP POLICY IF EXISTS "Users can view their tenant events" ON events;
DROP POLICY IF EXISTS "Users can create tenant events" ON events;
DROP POLICY IF EXISTS "Users can update tenant events" ON events;
DROP POLICY IF EXISTS "Admins can delete tenant events" ON events;

-- Create consolidated policies
CREATE POLICY "Anyone can view demo tenant events or events by passcode"
  ON events FOR SELECT
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR (is_active = true AND passcode IS NOT NULL)
    OR (auth.uid() IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Users can insert demo tenant or own tenant events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update demo tenant or own tenant events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete demo tenant or own tenant events"
  ON events FOR DELETE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============ PROMPTS TABLE ============
-- Drop all existing prompt policies
DROP POLICY IF EXISTS "Anyone can view global prompts" ON prompts;
DROP POLICY IF EXISTS "Public can manage demo tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Users can view their tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Users can create tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Users can update tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Admins can delete tenant prompts" ON prompts;

-- Create consolidated policies
CREATE POLICY "Anyone can view global or demo tenant or own tenant prompts"
  ON prompts FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR (auth.uid() IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Users can insert demo tenant or own tenant prompts"
  ON prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update demo tenant or own tenant prompts"
  ON prompts FOR UPDATE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete demo tenant or own tenant prompts"
  ON prompts FOR DELETE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============ EVENT_PROMPTS TABLE ============
-- Drop all existing event_prompts policies
DROP POLICY IF EXISTS "Public can manage demo tenant event prompts" ON event_prompts;
DROP POLICY IF EXISTS "Public can view event prompts" ON event_prompts;
DROP POLICY IF EXISTS "Users can view event prompts for tenant events" ON event_prompts;
DROP POLICY IF EXISTS "Users can insert event prompts" ON event_prompts;
DROP POLICY IF EXISTS "Users can delete event prompts" ON event_prompts;

-- Create consolidated policies
CREATE POLICY "Anyone can view demo tenant event prompts or own tenant event prompts"
  ON event_prompts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND (
        events.tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
        OR events.is_active = true
        OR (auth.uid() IS NOT NULL AND events.tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        ))
      )
    )
  );

CREATE POLICY "Users can insert demo tenant or own tenant event prompts"
  ON event_prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND (
        events.tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
        OR events.tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can delete demo tenant or own tenant event prompts"
  ON event_prompts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND (
        events.tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
        OR events.tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- ============ GENERATED_IMAGES TABLE ============
-- Drop all existing generated_images policies
DROP POLICY IF EXISTS "Public can view demo tenant generated images" ON generated_images;
DROP POLICY IF EXISTS "Public can view images for active events" ON generated_images;
DROP POLICY IF EXISTS "Users can view tenant generated images" ON generated_images;
DROP POLICY IF EXISTS "System can update generated images" ON generated_images;
DROP POLICY IF EXISTS "Users can update tenant generated images" ON generated_images;

-- Create consolidated policies
CREATE POLICY "Anyone can view demo tenant or active event generated images"
  ON generated_images FOR SELECT
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR EXISTS (
      SELECT 1 FROM events
      WHERE events.id = generated_images.event_id
      AND events.is_active = true
    )
    OR (auth.uid() IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Users can insert demo tenant or own tenant generated images"
  ON generated_images FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update demo tenant or own tenant generated images"
  ON generated_images FOR UPDATE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- ============ SUBSCRIPTION_LIMITS TABLE ============
-- Drop all existing subscription_limits policies
DROP POLICY IF EXISTS "Public can view demo tenant subscription limits" ON subscription_limits;
DROP POLICY IF EXISTS "Public can view subscription limits for active events" ON subscription_limits;
DROP POLICY IF EXISTS "Users can view their tenant subscription limits" ON subscription_limits;

-- Create consolidated policy
CREATE POLICY "Anyone can view demo tenant or active event subscription limits"
  ON subscription_limits FOR SELECT
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR EXISTS (
      SELECT 1 FROM events
      WHERE events.tenant_id = subscription_limits.tenant_id
      AND events.is_active = true
    )
    OR (auth.uid() IS NOT NULL AND tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    ))
  );

-- =====================================================
-- 4. FIX FUNCTION SEARCH_PATH SECURITY
-- =====================================================

-- Recreate functions with explicit search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION increment_image_usage(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE usage_logs
  SET images_generated = images_generated + 1
  WHERE tenant_id = p_tenant_id
    AND DATE(created_at) = CURRENT_DATE;
  
  IF NOT FOUND THEN
    INSERT INTO usage_logs (tenant_id, images_generated, sms_sent)
    VALUES (p_tenant_id, 1, 0);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION increment_sms_usage(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE usage_logs
  SET sms_sent = sms_sent + 1
  WHERE tenant_id = p_tenant_id
    AND DATE(created_at) = CURRENT_DATE;
  
  IF NOT FOUND THEN
    INSERT INTO usage_logs (tenant_id, images_generated, sms_sent)
    VALUES (p_tenant_id, 0, 1);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM users
  WHERE id = auth.uid();
  
  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION user_has_role(required_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
BEGIN
  SELECT role INTO v_user_role
  FROM users
  WHERE id = auth.uid();
  
  RETURN v_user_role = required_role;
END;
$$;

CREATE OR REPLACE FUNCTION user_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
BEGIN
  SELECT role INTO v_user_role
  FROM users
  WHERE id = auth.uid();
  
  RETURN v_user_role IN ('admin', 'owner');
END;
$$;