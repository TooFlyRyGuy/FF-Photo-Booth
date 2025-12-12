/*
  # Add Foreign Key Indexes and Consolidate RLS Policies

  This migration addresses security and performance issues:

  ## 1. Add Missing Foreign Key Indexes
  
  Creates indexes for all foreign keys that don't have covering indexes.
  This significantly improves query performance for joins and lookups.
  
  Affected tables:
  - event_prompts: index on prompt_id
  - events: index on created_by
  - generated_images: index on prompt_id
  - sms_logs: indexes on image_id and tenant_id
  - tenants: index on user_id
  - usage_logs: index on tenant_id
  - users: index on tenant_id

  ## 2. Consolidate Multiple Permissive Policies
  
  Combines multiple permissive policies into single policies to improve
  performance and maintainability. Each consolidated policy uses OR logic
  to handle both demo tenant and owned resource access.
  
  Affected tables:
  - event_prompts: DELETE, INSERT policies
  - events: DELETE, INSERT, UPDATE policies
  - generated_images: INSERT, UPDATE policies
  - prompts: DELETE, INSERT, UPDATE policies
  - tenants: SELECT, UPDATE policies

  ## Notes
  
  - All indexes use IF NOT EXISTS for safe reapplication
  - Policy logic remains identical, only consolidated for performance
  - Demo tenant UUID: 00000000-0000-0000-0000-000000000000
*/

-- ============================================================================
-- STEP 1: Add Missing Foreign Key Indexes
-- ============================================================================

-- event_prompts.prompt_id
CREATE INDEX IF NOT EXISTS idx_event_prompts_prompt_id 
  ON event_prompts(prompt_id);

-- events.created_by
CREATE INDEX IF NOT EXISTS idx_events_created_by 
  ON events(created_by);

-- generated_images.prompt_id
CREATE INDEX IF NOT EXISTS idx_generated_images_prompt_id 
  ON generated_images(prompt_id);

-- sms_logs.image_id
CREATE INDEX IF NOT EXISTS idx_sms_logs_image_id 
  ON sms_logs(image_id);

-- sms_logs.tenant_id
CREATE INDEX IF NOT EXISTS idx_sms_logs_tenant_id 
  ON sms_logs(tenant_id);

-- tenants.user_id
CREATE INDEX IF NOT EXISTS idx_tenants_user_id 
  ON tenants(user_id);

-- usage_logs.tenant_id
CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_id 
  ON usage_logs(tenant_id);

-- users.tenant_id
CREATE INDEX IF NOT EXISTS idx_users_tenant_id 
  ON users(tenant_id);

-- ============================================================================
-- STEP 2: Consolidate RLS Policies - Event Prompts
-- ============================================================================

-- Consolidate DELETE policies
DROP POLICY IF EXISTS "Anyone can delete demo tenant event prompts" ON event_prompts;
DROP POLICY IF EXISTS "Users can delete own tenant event prompts" ON event_prompts;

CREATE POLICY "Users can delete event prompts"
  ON event_prompts FOR DELETE
  TO authenticated
  USING (
    event_id IN (
      SELECT id FROM events 
      WHERE tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
      OR tenant_id IN (
        SELECT id FROM tenants WHERE user_id = (select auth.uid())
      )
    )
  );

-- Consolidate INSERT policies
DROP POLICY IF EXISTS "Anyone can insert demo tenant event prompts" ON event_prompts;
DROP POLICY IF EXISTS "Users can insert own tenant event prompts" ON event_prompts;

CREATE POLICY "Users can insert event prompts"
  ON event_prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT id FROM events 
      WHERE tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
      OR tenant_id IN (
        SELECT id FROM tenants WHERE user_id = (select auth.uid())
      )
    )
  );

-- ============================================================================
-- STEP 3: Consolidate RLS Policies - Events
-- ============================================================================

-- Consolidate DELETE policies
DROP POLICY IF EXISTS "Admins can delete own tenant events" ON events;
DROP POLICY IF EXISTS "Anyone can delete demo tenant events" ON events;

CREATE POLICY "Users can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

-- Consolidate INSERT policies
DROP POLICY IF EXISTS "Anyone can insert demo tenant events" ON events;
DROP POLICY IF EXISTS "Users can insert own tenant events" ON events;

CREATE POLICY "Users can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

-- Consolidate UPDATE policies
DROP POLICY IF EXISTS "Anyone can update demo tenant events" ON events;
DROP POLICY IF EXISTS "Users can update own tenant events" ON events;

CREATE POLICY "Users can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- STEP 4: Consolidate RLS Policies - Generated Images
-- ============================================================================

-- Consolidate INSERT policies
DROP POLICY IF EXISTS "Anyone can insert demo tenant generated images" ON generated_images;
DROP POLICY IF EXISTS "Users can insert own tenant generated images" ON generated_images;

CREATE POLICY "Users can insert generated images"
  ON generated_images FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

-- Consolidate UPDATE policies
DROP POLICY IF EXISTS "Anyone can update demo tenant generated images" ON generated_images;
DROP POLICY IF EXISTS "Users can update own tenant generated images" ON generated_images;

CREATE POLICY "Users can update generated images"
  ON generated_images FOR UPDATE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- STEP 5: Consolidate RLS Policies - Prompts
-- ============================================================================

-- Consolidate DELETE policies
DROP POLICY IF EXISTS "Anyone can delete demo tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Users can delete own tenant prompts" ON prompts;

CREATE POLICY "Users can delete prompts"
  ON prompts FOR DELETE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

-- Consolidate INSERT policies
DROP POLICY IF EXISTS "Anyone can insert demo tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Users can insert own tenant prompts" ON prompts;

CREATE POLICY "Users can insert prompts"
  ON prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

-- Consolidate UPDATE policies
DROP POLICY IF EXISTS "Anyone can update demo tenant prompts" ON prompts;
DROP POLICY IF EXISTS "Users can update own tenant prompts" ON prompts;

CREATE POLICY "Users can update prompts"
  ON prompts FOR UPDATE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- STEP 6: Consolidate RLS Policies - Tenants
-- ============================================================================

-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Anyone can view demo tenant or own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can view own tenant" ON tenants;

CREATE POLICY "Users can view tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    id = '00000000-0000-0000-0000-000000000000'::uuid
    OR user_id = (select auth.uid())
  );

-- Consolidate UPDATE policies
DROP POLICY IF EXISTS "Anyone can update demo tenant" ON tenants;
DROP POLICY IF EXISTS "Owners can update their tenant" ON tenants;
DROP POLICY IF EXISTS "Users can update own tenant" ON tenants;

CREATE POLICY "Users can update tenants"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    id = '00000000-0000-0000-0000-000000000000'::uuid
    OR user_id = (select auth.uid())
  )
  WITH CHECK (
    id = '00000000-0000-0000-0000-000000000000'::uuid
    OR user_id = (select auth.uid())
  );
