/*
  # Enable Public Kiosk Access

  1. Changes
    - Add public read access to active events
    - Add public insert access to generated_images (for kiosk photo generation)
    - Add public read access to tenants (for kiosk to access Dropbox/Twilio/Gemini settings)
    - These policies allow kiosk mode to work without authentication
  
  2. Security
    - Events: Only active events are visible to public
    - Generated_images: Public can only insert, not update or delete
    - Tenants: Public can read all tenant data (needed for integration settings)
    - All other operations still require authentication
*/

-- Allow public to view active events
CREATE POLICY "Public can view active events"
  ON events FOR SELECT
  TO public
  USING (is_active = true);

-- Allow public to insert generated images (for kiosk photo generation)
CREATE POLICY "Public can create generated images"
  ON generated_images FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow public to read tenants (needed for Dropbox/Twilio/Gemini settings in kiosk)
CREATE POLICY "Public can view tenants"
  ON tenants FOR SELECT
  TO public
  USING (true);
