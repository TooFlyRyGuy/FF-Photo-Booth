/*
  # Allow Demo Tenant Access

  ## Overview
  Enable public read access to the demo tenant and its associated data
  for development and testing purposes.

  ## Changes
  1. Add policy to allow public read access to demo tenant
  2. Add policy to allow public read access to demo tenant subscription limits
  3. Update events policies to support unauthenticated admin access

  ## Security Note
  These policies are for the demo tenant only. Production tenants
  would require proper authentication via Supabase Auth.
*/

-- Allow public read access to the demo tenant
CREATE POLICY "Public can view demo tenant"
  ON tenants FOR SELECT
  TO public
  USING (id = '00000000-0000-0000-0000-000000000001');

-- Allow public read access to demo tenant subscription limits
CREATE POLICY "Public can view demo tenant subscription limits"
  ON subscription_limits FOR SELECT
  TO public
  USING (tenant_id = '00000000-0000-0000-0000-000000000001');

-- Allow public read/write access to demo tenant events (for admin dashboard without auth)
CREATE POLICY "Public can manage demo tenant events"
  ON events FOR ALL
  TO public
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

-- Allow public read/write access to demo tenant prompts
CREATE POLICY "Public can manage demo tenant prompts"
  ON prompts FOR ALL
  TO public
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

-- Allow public read/write access to demo tenant event_prompts
CREATE POLICY "Public can manage demo tenant event prompts"
  ON event_prompts FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND events.tenant_id = '00000000-0000-0000-0000-000000000001'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_prompts.event_id
      AND events.tenant_id = '00000000-0000-0000-0000-000000000001'
    )
  );