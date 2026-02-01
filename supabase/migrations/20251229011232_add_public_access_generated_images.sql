/*
  # Add Public Access for Generated Images in Kiosk Mode

  1. Purpose
    - Allow anonymous users to save generated images for active events
    - Enable kiosk mode to work without authentication

  2. Changes
    - Add INSERT policy for anon role on generated_images table
    - Policy restricted to active events only
    - user_id can be null for anonymous kiosk users

  3. Security
    - Only images for active events can be inserted
    - Read-only access is still restricted to authenticated users
    - Anonymous users cannot read other users' images
*/

-- Ensure user_id exists before altering it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_images' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE generated_images ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Update generated_images table to allow null user_id
ALTER TABLE generated_images ALTER COLUMN user_id DROP NOT NULL;

-- Add public access to insert generated images for active events
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can insert generated images for active events" ON generated_images;
  
  CREATE POLICY "Public can insert generated images for active events"
    ON generated_images
    FOR INSERT
    TO anon
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM events
        WHERE events.id = generated_images.event_id
        AND events.is_active = true
      )
    );
END $$;

-- Allow authenticated users to read images for their events
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read own generated images" ON generated_images;
  
  CREATE POLICY "Users can read own generated images"
    ON generated_images
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);
END $$;
