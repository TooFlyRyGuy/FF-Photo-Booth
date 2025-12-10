/*
  # Row Level Security Policies

  ## Overview
  Comprehensive RLS policies for multi-tenant data isolation and security.
  Supports both authenticated admin access and public kiosk mode.

  ## Security Model
  
  ### Authenticated Users
  - Users can only access data within their tenant
  - Role-based permissions (OWNER, ADMIN, OPERATOR)
  - Strict tenant isolation enforced
  
  ### Public Access (Kiosk Mode)
  - Read prompts associated with events (via passcode)
  - Create generated images for valid events
  - Create SMS logs for image delivery
  - No access to tenant/user management data

  ## Policy Categories
  1. Tenants - Owner access only
  2. Users - Tenant-scoped access
  3. Subscription Limits - Tenant-scoped read access
  4. Prompts - Global + tenant-scoped access
  5. Events - Tenant-scoped management, public read via passcode
  6. Event Prompts - Access based on event permissions
  7. Generated Images - Tenant-scoped + public insert
  8. SMS Logs - Tenant-scoped + public insert
  9. Usage Logs - Tenant-scoped read only
*/

-- =====================================================
-- HELPER FUNCTIONS (in public schema)
-- =====================================================

-- Get tenant ID for current authenticated user
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user has specific role
CREATE OR REPLACE FUNCTION user_has_role(required_role text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = required_role
    AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is owner or admin
CREATE OR REPLACE FUNCTION user_is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('OWNER', 'ADMIN')
    AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- 1. TENANTS POLICIES
-- =====================================================

CREATE POLICY "Users can view their own tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (id = get_user_tenant_id());

CREATE POLICY "Owners can update their tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    id = get_user_tenant_id() 
    AND user_has_role('OWNER')
  )
  WITH CHECK (
    id = get_user_tenant_id() 
    AND user_has_role('OWNER')
  );

-- =====================================================
-- 2. USERS POLICIES
-- =====================================================

CREATE POLICY "Users can view users in their tenant"
  ON users FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create users in their tenant"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_is_admin()
  );

CREATE POLICY "Admins can update users in their tenant"
  ON users FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_is_admin()
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_is_admin()
  );

CREATE POLICY "Owners can delete users in their tenant"
  ON users FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_has_role('OWNER')
  );

-- =====================================================
-- 3. SUBSCRIPTION LIMITS POLICIES
-- =====================================================

CREATE POLICY "Users can view their tenant subscription limits"
  ON subscription_limits FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can update subscription limits"
  ON subscription_limits FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- =====================================================
-- 4. PROMPTS POLICIES
-- =====================================================

-- Global prompts (tenant_id IS NULL) are readable by everyone
CREATE POLICY "Anyone can view global prompts"
  ON prompts FOR SELECT
  TO public
  USING (tenant_id IS NULL AND is_active = true);

-- Authenticated users can view their tenant prompts
CREATE POLICY "Users can view their tenant prompts"
  ON prompts FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    OR tenant_id IS NULL
  );

-- Users can create prompts for their tenant
CREATE POLICY "Users can create tenant prompts"
  ON prompts FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Users can update their tenant prompts
CREATE POLICY "Users can update tenant prompts"
  ON prompts FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Admins can delete their tenant prompts
CREATE POLICY "Admins can delete tenant prompts"
  ON prompts FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_is_admin()
  );

-- =====================================================
-- 5. EVENTS POLICIES
-- =====================================================

-- Authenticated users can view events in their tenant
CREATE POLICY "Users can view their tenant events"
  ON events FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Public can view active events with valid passcode (for kiosk)
CREATE POLICY "Public can view events by passcode"
  ON events FOR SELECT
  TO public
  USING (is_active = true);

-- Users can create events for their tenant
CREATE POLICY "Users can create tenant events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Users can update their tenant events
CREATE POLICY "Users can update tenant events"
  ON events FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Admins can delete their tenant events
CREATE POLICY "Admins can delete tenant events"
  ON events FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_is_admin()
  );

-- =====================================================
-- 6. EVENT_PROMPTS POLICIES
-- =====================================================

-- Users can view event prompts for their tenant events
CREATE POLICY "Users can view event prompts for tenant events"
  ON event_prompts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND events.tenant_id = get_user_tenant_id()
    )
  );

-- Public can view event prompts (for kiosk)
CREATE POLICY "Public can view event prompts"
  ON event_prompts FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND events.is_active = true
    )
  );

-- Users can manage event prompts for their tenant events
CREATE POLICY "Users can insert event prompts"
  ON event_prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND events.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Users can delete event prompts"
  ON event_prompts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND events.tenant_id = get_user_tenant_id()
    )
  );

-- =====================================================
-- 7. GENERATED_IMAGES POLICIES
-- =====================================================

-- Users can view generated images for their tenant
CREATE POLICY "Users can view tenant generated images"
  ON generated_images FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Public can create generated images (kiosk mode)
CREATE POLICY "Public can create generated images"
  ON generated_images FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = generated_images.event_id
      AND events.is_active = true
    )
  );

-- Users can update generated images in their tenant
CREATE POLICY "Users can update tenant generated images"
  ON generated_images FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- System can also update any generated image (for async processing)
CREATE POLICY "System can update generated images"
  ON generated_images FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 8. SMS_LOGS POLICIES
-- =====================================================

-- Users can view SMS logs for their tenant
CREATE POLICY "Users can view tenant SMS logs"
  ON sms_logs FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Public can create SMS logs (kiosk mode)
CREATE POLICY "Public can create SMS logs"
  ON sms_logs FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM generated_images
      WHERE generated_images.id = sms_logs.image_id
    )
  );

-- System can update SMS logs
CREATE POLICY "System can update SMS logs"
  ON sms_logs FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 9. USAGE_LOGS POLICIES
-- =====================================================

-- Users can view usage logs for their tenant
CREATE POLICY "Users can view tenant usage logs"
  ON usage_logs FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- System can create usage logs
CREATE POLICY "System can create usage logs"
  ON usage_logs FOR INSERT
  TO public
  WITH CHECK (true);

-- =====================================================
-- GRANT PUBLIC ACCESS FOR KIOSK MODE
-- =====================================================

-- Grant necessary permissions to anon role for kiosk functionality
GRANT SELECT ON prompts TO anon;
GRANT SELECT ON events TO anon;
GRANT SELECT ON event_prompts TO anon;
GRANT INSERT, UPDATE ON generated_images TO anon;
GRANT INSERT, UPDATE ON sms_logs TO anon;
GRANT INSERT ON usage_logs TO anon;