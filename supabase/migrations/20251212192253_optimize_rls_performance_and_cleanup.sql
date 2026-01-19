/*
  # Optimize RLS Performance and Database Cleanup

  This migration addresses critical performance and security issues identified by Supabase:

  ## 1. RLS Performance Optimization
  
  All RLS policies using `auth.<function>()` are updated to use `(select auth.<function>())`.
  This prevents re-evaluation for each row, dramatically improving query performance at scale.
  
  Affected tables:
  - stripe_customers (1 policy)
  - stripe_subscriptions (1 policy)
  - stripe_orders (1 policy)
  - prompts (6 policies)
  - generated_images (5 policies)
  - events (6 policies)
  - user_profiles (3 policies)
  - tenants (6 policies)
  - subscription_limits (3 policies)
  - event_prompts (3 policies)
  - global_settings (4 policies)

  ## 2. Remove Unused Indexes
  
  Removes indexes that are not being utilized to reduce database overhead and maintenance costs.

  ## 3. Fix Function Security
  
  Updates trigger functions to have immutable search paths for enhanced security.

  ## Notes
  
  - All policy changes maintain the same access control logic
  - Only the performance characteristics are improved
  - Unused indexes are safely removed with IF EXISTS checks
*/

-- ============================================================================
-- STEP 1: Fix RLS Policies for Performance - Stripe Tables
-- ============================================================================

-- stripe_customers: uses user_id directly
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stripe_customers') THEN
    DROP POLICY IF EXISTS "Users can view their own customer data" ON stripe_customers;
    CREATE POLICY "Users can view their own customer data"
      ON stripe_customers FOR SELECT
      TO authenticated
      USING (user_id = (select auth.uid()) AND deleted_at IS NULL);
  END IF;
END $$;

-- stripe_subscriptions: joins through stripe_customers
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stripe_subscriptions') THEN
    DROP POLICY IF EXISTS "Users can view their own subscription data" ON stripe_subscriptions;
    CREATE POLICY "Users can view their own subscription data"
      ON stripe_subscriptions FOR SELECT
      TO authenticated
      USING (
        customer_id IN (
          SELECT customer_id
          FROM stripe_customers
          WHERE user_id = (select auth.uid()) AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
      );
  END IF;
END $$;

-- stripe_orders: joins through stripe_customers
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stripe_orders') THEN
    DROP POLICY IF EXISTS "Users can view their own order data" ON stripe_orders;
    CREATE POLICY "Users can view their own order data"
      ON stripe_orders FOR SELECT
      TO authenticated
      USING (
        customer_id IN (
          SELECT customer_id
          FROM stripe_customers
          WHERE user_id = (select auth.uid()) AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
      );
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Fix RLS Policies for Performance - User Profiles
-- ============================================================================

-- user_profiles: id is the auth user id
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- ============================================================================
-- STEP 3: Fix RLS Policies for Performance - Tenants (DEPRECATED - Table removed in later migration)
-- ============================================================================

-- NOTE: The tenants table was removed in migration 20251228235731_remove_tenants_add_hybrid_pricing_final.sql
-- These policies are kept for backwards compatibility with existing databases but are skipped if table doesn't exist

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants') THEN
    DROP POLICY IF EXISTS "Users can view own tenant" ON tenants;
    CREATE POLICY "Users can view own tenant"
      ON tenants FOR SELECT
      TO authenticated
      USING (user_id = (select auth.uid()));

    DROP POLICY IF EXISTS "Users can update own tenant" ON tenants;
    CREATE POLICY "Users can update own tenant"
      ON tenants FOR UPDATE
      TO authenticated
      USING (user_id = (select auth.uid()))
      WITH CHECK (user_id = (select auth.uid()));

    DROP POLICY IF EXISTS "Users can insert own tenant" ON tenants;
    CREATE POLICY "Users can insert own tenant"
      ON tenants FOR INSERT
      TO authenticated
      WITH CHECK (user_id = (select auth.uid()));

    DROP POLICY IF EXISTS "Anyone can view demo tenant or own tenant" ON tenants;
    CREATE POLICY "Anyone can view demo tenant or own tenant"
      ON tenants FOR SELECT
      USING (
        id = '00000000-0000-0000-0000-000000000000'::uuid
        OR user_id = (select auth.uid())
      );

    DROP POLICY IF EXISTS "Owners can update their tenant" ON tenants;
    CREATE POLICY "Owners can update their tenant"
      ON tenants FOR UPDATE
      TO authenticated
      USING (user_id = (select auth.uid()))
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Fix RLS Policies for Performance - Prompts (DEPRECATED - References removed tenants table)
-- ============================================================================

-- NOTE: These policies reference the tenants table which was removed in a later migration
-- They are skipped if the tenants table doesn't exist

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants') THEN
    DROP POLICY IF EXISTS "Users can insert own tenant prompts" ON prompts;
    CREATE POLICY "Users can insert own tenant prompts"
      ON prompts FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );

    DROP POLICY IF EXISTS "Users can update own tenant prompts" ON prompts;
    CREATE POLICY "Users can update own tenant prompts"
      ON prompts FOR UPDATE
      TO authenticated
      USING (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );

    DROP POLICY IF EXISTS "Users can delete own tenant prompts" ON prompts;
    CREATE POLICY "Users can delete own tenant prompts"
      ON prompts FOR DELETE
      TO authenticated
      USING (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );

    DROP POLICY IF EXISTS "Anyone can view global or demo tenant or own tenant prompts" ON prompts;
    CREATE POLICY "Anyone can view global or demo tenant or own tenant prompts"
      ON prompts FOR SELECT
      USING (
        tenant_id IS NULL
        OR tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
        OR tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Fix RLS Policies for Performance - Generated Images (DEPRECATED - References removed tenants table)
-- ============================================================================

-- NOTE: These policies reference the tenants table which was removed in a later migration
-- They are skipped if the tenants table doesn't exist

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants') THEN
    DROP POLICY IF EXISTS "Users can insert own tenant generated images" ON generated_images;
    CREATE POLICY "Users can insert own tenant generated images"
      ON generated_images FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );

    DROP POLICY IF EXISTS "Users can update own tenant generated images" ON generated_images;
    CREATE POLICY "Users can update own tenant generated images"
      ON generated_images FOR UPDATE
      TO authenticated
      USING (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );

    DROP POLICY IF EXISTS "Anyone can view demo tenant or active event generated images" ON generated_images;
    CREATE POLICY "Anyone can view demo tenant or active event generated images"
      ON generated_images FOR SELECT
      USING (
        tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
        OR event_id IN (
          SELECT id FROM events WHERE is_active = true
        )
        OR tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Fix RLS Policies for Performance - Events (DEPRECATED - References removed tenants table)
-- ============================================================================

-- NOTE: These policies reference the tenants table which was removed in a later migration
-- They are skipped if the tenants table doesn't exist

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants') THEN
    DROP POLICY IF EXISTS "Admins can delete own tenant events" ON events;
    CREATE POLICY "Admins can delete own tenant events"
      ON events FOR DELETE
      TO authenticated
      USING (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );

    DROP POLICY IF EXISTS "Users can insert own tenant events" ON events;
    CREATE POLICY "Users can insert own tenant events"
      ON events FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );

    DROP POLICY IF EXISTS "Users can update own tenant events" ON events;
    CREATE POLICY "Users can update own tenant events"
      ON events FOR UPDATE
      TO authenticated
      USING (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );

    DROP POLICY IF EXISTS "Anyone can view demo tenant events or events by passcode" ON events;
    CREATE POLICY "Anyone can view demo tenant events or events by passcode"
      ON events FOR SELECT
      USING (
        tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
        OR tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Fix RLS Policies for Performance - Subscription Limits (DEPRECATED - References removed tenants table)
-- ============================================================================

-- NOTE: These policies reference the tenants table which was removed in a later migration
-- The subscription_limits table itself was also likely removed. Policies are skipped if table doesn't exist

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_limits')
     AND EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants') THEN
    DROP POLICY IF EXISTS "Users can view own subscription limits" ON subscription_limits;
    CREATE POLICY "Users can view own subscription limits"
      ON subscription_limits FOR SELECT
      TO authenticated
      USING (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );

    DROP POLICY IF EXISTS "Users can insert subscription limits for own tenant" ON subscription_limits;
    CREATE POLICY "Users can insert subscription limits for own tenant"
      ON subscription_limits FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );

    DROP POLICY IF EXISTS "Users can update subscription limits for own tenant" ON subscription_limits;
    CREATE POLICY "Users can update subscription limits for own tenant"
      ON subscription_limits FOR UPDATE
      TO authenticated
      USING (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT id FROM tenants WHERE user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- ============================================================================
-- STEP 8: Fix RLS Policies for Performance - Event Prompts (DEPRECATED - References removed tenants table)
-- ============================================================================

-- NOTE: These policies reference the tenants table which was removed in a later migration
-- They are skipped if the tenants table doesn't exist

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants') THEN
    DROP POLICY IF EXISTS "Users can delete own tenant event prompts" ON event_prompts;
    CREATE POLICY "Users can delete own tenant event prompts"
      ON event_prompts FOR DELETE
      TO authenticated
      USING (
        event_id IN (
          SELECT id FROM events WHERE tenant_id IN (
            SELECT id FROM tenants WHERE user_id = (select auth.uid())
          )
        )
      );

    DROP POLICY IF EXISTS "Users can insert own tenant event prompts" ON event_prompts;
    CREATE POLICY "Users can insert own tenant event prompts"
      ON event_prompts FOR INSERT
      TO authenticated
      WITH CHECK (
        event_id IN (
          SELECT id FROM events WHERE tenant_id IN (
            SELECT id FROM tenants WHERE user_id = (select auth.uid())
          )
        )
      );

    DROP POLICY IF EXISTS "Anyone can view demo tenant or active event prompts" ON event_prompts;
    CREATE POLICY "Anyone can view demo tenant or active event prompts"
      ON event_prompts FOR SELECT
      USING (
        event_id IN (
          SELECT id FROM events
          WHERE tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
          OR is_active = true
          OR tenant_id IN (
            SELECT id FROM tenants WHERE user_id = (select auth.uid())
          )
        )
      );
  END IF;
END $$;

-- ============================================================================
-- STEP 9: Fix RLS Policies for Performance - Global Settings
-- ============================================================================

-- NOTE: Updated to use 'role' column instead of deprecated 'subscription_tier' column
-- Uses conditional logic to support both old and new schema

DO $$ BEGIN
  -- Check if subscription_tier column exists (old schema) or role column exists (new schema)
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
    -- New schema with 'role' column
    DROP POLICY IF EXISTS "Admins can view global settings" ON global_settings;
    CREATE POLICY "Admins can view global settings"
      ON global_settings FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = (select auth.uid()) AND role = 'admin'
        )
      );

    DROP POLICY IF EXISTS "Admins can insert global settings" ON global_settings;
    CREATE POLICY "Admins can insert global settings"
      ON global_settings FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = (select auth.uid()) AND role = 'admin'
        )
      );

    DROP POLICY IF EXISTS "Admins can update global settings" ON global_settings;
    CREATE POLICY "Admins can update global settings"
      ON global_settings FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = (select auth.uid()) AND role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = (select auth.uid()) AND role = 'admin'
        )
      );

    DROP POLICY IF EXISTS "Admins can delete global settings" ON global_settings;
    CREATE POLICY "Admins can delete global settings"
      ON global_settings FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = (select auth.uid()) AND role = 'admin'
        )
      );
  ELSIF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'subscription_tier') THEN
    -- Old schema with 'subscription_tier' column
    DROP POLICY IF EXISTS "Admins can view global settings" ON global_settings;
    CREATE POLICY "Admins can view global settings"
      ON global_settings FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = (select auth.uid()) AND subscription_tier = 'admin'
        )
      );

    DROP POLICY IF EXISTS "Admins can insert global settings" ON global_settings;
    CREATE POLICY "Admins can insert global settings"
      ON global_settings FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = (select auth.uid()) AND subscription_tier = 'admin'
        )
      );

    DROP POLICY IF EXISTS "Admins can update global settings" ON global_settings;
    CREATE POLICY "Admins can update global settings"
      ON global_settings FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = (select auth.uid()) AND subscription_tier = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = (select auth.uid()) AND subscription_tier = 'admin'
        )
      );

    DROP POLICY IF EXISTS "Admins can delete global settings" ON global_settings;
    CREATE POLICY "Admins can delete global settings"
      ON global_settings FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = (select auth.uid()) AND subscription_tier = 'admin'
        )
      );
  END IF;
END $$;

-- ============================================================================
-- STEP 10: Remove Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_users_tenant_id;
DROP INDEX IF EXISTS idx_prompts_tenant_active;
DROP INDEX IF EXISTS idx_prompts_active_created;
DROP INDEX IF EXISTS idx_prompts_is_active;
DROP INDEX IF EXISTS idx_prompts_created_at;
DROP INDEX IF EXISTS idx_generated_images_prompt_id;
DROP INDEX IF EXISTS idx_generated_images_tenant_status;
DROP INDEX IF EXISTS idx_generated_images_tenant_status_created;
DROP INDEX IF EXISTS idx_generated_images_status;
DROP INDEX IF EXISTS idx_generated_images_created_at;
DROP INDEX IF EXISTS idx_sms_logs_image_id;
DROP INDEX IF EXISTS idx_sms_logs_tenant_id;
DROP INDEX IF EXISTS idx_usage_logs_tenant_id;
DROP INDEX IF EXISTS idx_event_prompts_prompt_id;
DROP INDEX IF EXISTS idx_events_created_by;
DROP INDEX IF EXISTS idx_events_tenant_active;
DROP INDEX IF EXISTS idx_events_tenant_created;
DROP INDEX IF EXISTS idx_events_is_active;
DROP INDEX IF EXISTS idx_global_settings_key;
DROP INDEX IF EXISTS idx_tenants_user_id;

-- ============================================================================
-- STEP 11: Fix Function Security (Immutable Search Path)
-- ============================================================================

-- Fix update_global_settings_updated_at
CREATE OR REPLACE FUNCTION update_global_settings_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix handle_new_user (DEPRECATED - References removed tenants table)
-- NOTE: This function references the tenants table which was removed in a later migration
-- It is only created if the tenants table exists for backwards compatibility

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants')
     AND EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_limits') THEN
    CREATE OR REPLACE FUNCTION handle_new_user()
    RETURNS TRIGGER
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $func$
    DECLARE
      new_tenant_id uuid;
    BEGIN
      new_tenant_id := gen_random_uuid();

      INSERT INTO public.tenants (id, user_id, name, created_at, updated_at)
      VALUES (new_tenant_id, NEW.id, COALESCE(NEW.email, 'New Tenant'), now(), now());

      INSERT INTO public.user_profiles (id, email, tenant_id, subscription_tier, created_at, updated_at)
      VALUES (NEW.id, NEW.email, new_tenant_id, 'free', now(), now());

      INSERT INTO public.subscription_limits (tenant_id, images_limit, sms_limit, images_used, sms_used)
      VALUES (new_tenant_id, 10, 5, 0, 0);

      RETURN NEW;
    END;
    $func$;
  END IF;
END $$;
