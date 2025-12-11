/*
  # Allow Public Access to Demo Tenant Generated Images

  1. Changes
    - Add RLS policy to allow public users to view generated images for demo tenant
    - This enables the kiosk and admin views to work without authentication

  2. Security
    - Only applies to images belonging to the demo tenant
    - Does not affect other tenants which still require authentication
*/

CREATE POLICY "Public can view demo tenant generated images"
  ON generated_images
  FOR SELECT
  TO public
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);
