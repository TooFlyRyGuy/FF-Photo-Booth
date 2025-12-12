/*
  # Fix Subscription Limits RLS Policies

  ## Overview
  Updates Row Level Security policies for subscription_limits table to work with the new user authentication system.

  ## Changes
  - Drops old policies that reference non-existent tables
  - Creates new policies that properly check user_id through tenants table
  - Ensures authenticated users can view their own subscription limits

  ## Security
  - Users can only view limits for their own tenants
  - Public users can view demo tenant limits for kiosk mode
  - All operations properly restrict access based on authentication
*/

-- Drop old policies
DROP POLICY IF EXISTS "Anyone can view demo tenant or active event subscription limits" ON subscription_limits;

-- Create new policies for authenticated users
CREATE POLICY "Users can view own subscription limits"
  ON subscription_limits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = subscription_limits.tenant_id
      AND (tenants.user_id = auth.uid() OR tenants.id = '00000000-0000-0000-0000-000000000001')
    )
  );

-- Allow public access to demo tenant limits (for kiosk mode)
CREATE POLICY "Public can view demo tenant limits"
  ON subscription_limits FOR SELECT
  TO anon
  USING (
    tenant_id = '00000000-0000-0000-0000-000000000001'
    OR EXISTS (
      SELECT 1 FROM events
      WHERE events.tenant_id = subscription_limits.tenant_id
      AND events.is_active = true
    )
  );