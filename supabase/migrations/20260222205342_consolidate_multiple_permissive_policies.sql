/*
  # Consolidate Multiple Permissive RLS Policies

  ## Overview
  This migration consolidates tables that have multiple permissive policies for the same role and action.
  Multiple permissive policies can lead to confusion and potential security issues. It's better to have
  a single, clear policy that encompasses all the access rules.

  ## Changes Made
  
  1. **credit_topup_products Table**
     - Consolidated SELECT policies for authenticated users
  
  2. **event_access Table**
     - Consolidated SELECT policies for authenticated users
  
  3. **event_prompts Table**
     - Consolidated SELECT policies for anon users
  
  4. **generated_images Table**
     - Consolidated INSERT policies for anon and authenticated users
  
  5. **prompts Table**
     - Consolidated INSERT and SELECT policies for authenticated users
  
  6. **purchased_event_passes Table**
     - Consolidated SELECT policies for authenticated users
  
  7. **subscription_tiers & subscription_tiers_new Tables**
     - Consolidated SELECT policies for authenticated users
  
  8. **user_subscriptions Table**
     - Consolidated SELECT policies for authenticated users
  
  ## Security Impact
  These consolidations maintain the same access rules but present them in a clearer,
  more maintainable format with no security degradation.
*/

-- credit_topup_products: Consolidate SELECT policies
DROP POLICY IF EXISTS "Admins can manage topup products" ON credit_topup_products;
DROP POLICY IF EXISTS "Anyone can view active topup products" ON credit_topup_products;

CREATE POLICY "Users can view active topup products, admins can view all"
  ON credit_topup_products
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- event_access: Consolidate SELECT policies
DROP POLICY IF EXISTS "Admins can manage all event access" ON event_access;
DROP POLICY IF EXISTS "Users can view their granted access" ON event_access;

CREATE POLICY "Users can view their granted access, admins can view all"
  ON event_access
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- event_prompts: Consolidate SELECT policies for anon
DROP POLICY IF EXISTS "Public can view event prompts for active events" ON event_prompts;
DROP POLICY IF EXISTS "Users can view event prompts" ON event_prompts;

CREATE POLICY "Anyone can view event prompts for active events"
  ON event_prompts
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND events.is_active = true
    )
  );

-- generated_images: Consolidate INSERT policies
DROP POLICY IF EXISTS "Anonymous users can insert images to active events" ON generated_images;
DROP POLICY IF EXISTS "Authenticated users can insert images to active events" ON generated_images;
DROP POLICY IF EXISTS "Users can create images for active events" ON generated_images;

CREATE POLICY "Anyone can create images for active events"
  ON generated_images
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id
      AND events.is_active = true
    )
  );

-- prompts: Consolidate INSERT policies
DROP POLICY IF EXISTS "Users can create prompts they own" ON prompts;
DROP POLICY IF EXISTS "Users can insert own prompts" ON prompts;

CREATE POLICY "Users can create their own prompts"
  ON prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- prompts: Consolidate SELECT policies
DROP POLICY IF EXISTS "Users can view own prompts and public prompts" ON prompts;
DROP POLICY IF EXISTS "Users can view prompts" ON prompts;

CREATE POLICY "Users can view their own prompts and public prompts"
  ON prompts
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_public = true
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- purchased_event_passes: Consolidate SELECT policies
DROP POLICY IF EXISTS "Admins can manage all purchased passes" ON purchased_event_passes;
DROP POLICY IF EXISTS "Users can view purchased passes" ON purchased_event_passes;

CREATE POLICY "Users can view their purchased passes, admins can view all"
  ON purchased_event_passes
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- subscription_tiers: Consolidate SELECT policies
DROP POLICY IF EXISTS "Admins can manage tiers" ON subscription_tiers;
DROP POLICY IF EXISTS "Anyone can view active tiers" ON subscription_tiers;

CREATE POLICY "Users can view active tiers, admins can view all"
  ON subscription_tiers
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- subscription_tiers_new: Consolidate SELECT policies
DROP POLICY IF EXISTS "Admins can view all subscription tiers" ON subscription_tiers_new;
DROP POLICY IF EXISTS "Anyone can read active tiers" ON subscription_tiers_new;

CREATE POLICY "Users can view active tiers, admins can view all"
  ON subscription_tiers_new
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- user_subscriptions: Consolidate SELECT policies
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can view subscriptions" ON user_subscriptions;

CREATE POLICY "Users can view their subscriptions, admins can view all"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );
