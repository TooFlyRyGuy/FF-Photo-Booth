/*
  # Add INSERT policy for subscription_limits

  ## Overview
  Adds a missing INSERT policy for the subscription_limits table to allow
  the signup trigger to create subscription limits for new users.

  ## Changes
  - Adds INSERT policy for authenticated users to create subscription limits
    for their own tenants

  ## Important Notes
  - This fixes the "Database error saving new user" issue
  - The policy ensures users can only create limits for their own tenants
*/

-- Add INSERT policy for subscription_limits
CREATE POLICY "Users can insert subscription limits for own tenant"
  ON subscription_limits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = subscription_limits.tenant_id
      AND tenants.user_id = auth.uid()
    )
  );

-- Also add UPDATE policy for subscription_limits
CREATE POLICY "Users can update subscription limits for own tenant"
  ON subscription_limits
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = subscription_limits.tenant_id
      AND tenants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = subscription_limits.tenant_id
      AND tenants.user_id = auth.uid()
    )
  );
