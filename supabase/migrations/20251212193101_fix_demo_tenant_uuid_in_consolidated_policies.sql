/*
  # Fix Demo Tenant UUID in Consolidated Policies

  ## Issue
  
  The demo tenant UUID should be '00000000-0000-0000-0000-000000000001' (ending in 1)
  but was incorrectly set to '00000000-0000-0000-0000-000000000000' (ending in 0)
  in recent policy migrations. This causes events and other resources not to load
  correctly for users.

  ## Changes
  
  Updates all RLS policies to use the correct demo tenant UUID:
  - event_prompts policies
  - events policies
  - generated_images policies
  - prompts policies
  - tenants policies

  ## Note
  
  This migration recreates the consolidated policies from the previous migration
  with the correct demo tenant UUID.
*/

-- ============================================================================
-- Fix Event Prompts Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete event prompts" ON event_prompts;
CREATE POLICY "Users can delete event prompts"
  ON event_prompts FOR DELETE
  TO authenticated
  USING (
    event_id IN (
      SELECT id FROM events 
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR tenant_id IN (
        SELECT id FROM tenants WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert event prompts" ON event_prompts;
CREATE POLICY "Users can insert event prompts"
  ON event_prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT id FROM events 
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR tenant_id IN (
        SELECT id FROM tenants WHERE user_id = (select auth.uid())
      )
    )
  );

-- ============================================================================
-- Fix Events Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete events" ON events;
CREATE POLICY "Users can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert events" ON events;
CREATE POLICY "Users can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update events" ON events;
CREATE POLICY "Users can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

-- Fix SELECT policy for events
DROP POLICY IF EXISTS "Anyone can view demo tenant events or events by passcode" ON events;
CREATE POLICY "Users can view events"
  ON events FOR SELECT
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- Fix Generated Images Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert generated images" ON generated_images;
CREATE POLICY "Users can insert generated images"
  ON generated_images FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update generated images" ON generated_images;
CREATE POLICY "Users can update generated images"
  ON generated_images FOR UPDATE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- Fix Prompts Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete prompts" ON prompts;
CREATE POLICY "Users can delete prompts"
  ON prompts FOR DELETE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert prompts" ON prompts;
CREATE POLICY "Users can insert prompts"
  ON prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update prompts" ON prompts;
CREATE POLICY "Users can update prompts"
  ON prompts FOR UPDATE
  TO authenticated
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR tenant_id IN (
      SELECT id FROM tenants WHERE user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- Fix Tenants Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view tenants" ON tenants;
CREATE POLICY "Users can view tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    id = '00000000-0000-0000-0000-000000000001'::uuid
    OR user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can update tenants" ON tenants;
CREATE POLICY "Users can update tenants"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    id = '00000000-0000-0000-0000-000000000001'::uuid
    OR user_id = (select auth.uid())
  )
  WITH CHECK (
    id = '00000000-0000-0000-0000-000000000001'::uuid
    OR user_id = (select auth.uid())
  );
