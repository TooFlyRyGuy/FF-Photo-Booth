/*
  # Fix Authenticated Users Insert Policy for Generated Images
  
  1. Purpose
    - Allow authenticated users to insert generated images for their events
    - Fix issue where kiosk mode fails for authenticated users
  
  2. Changes
    - Update INSERT policy for authenticated users to check event ownership
    - Allow inserting generated images for events the user owns
  
  3. Security
    - Authenticated users can insert images for events they own
    - Anonymous users can insert images for active events (existing policy)
*/

-- Drop the existing authenticated insert policy
DROP POLICY IF EXISTS "Users can insert own generated images" ON generated_images;

-- Create a new policy that allows authenticated users to insert images for their events
CREATE POLICY "Users can insert generated images for their events"
  ON generated_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = generated_images.event_id
      AND events.user_id = auth.uid()
    )
  );
