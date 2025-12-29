/*
  # Fix Generated Images RLS for Event Owners

  ## Overview
  Allows authenticated users to view generated images from their own events,
  even if the image was created by someone else (e.g., in kiosk mode).

  ## Changes
  1. Drop the existing restrictive SELECT policy
  2. Create a new SELECT policy that allows users to see:
     - Images they created (user_id matches)
     - Images from events they own (via events.user_id)
     - Images with null user_id (kiosk mode)

  ## Security
  - Users can still only see images from their own events
  - Does not expose images from other users' events
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can read own generated images" ON generated_images;

-- Create a new policy that allows event owners to see all images from their events
CREATE POLICY "Users can read generated images from own events"
  ON generated_images FOR SELECT
  TO authenticated
  USING (
    -- User created the image
    user_id = auth.uid()
    OR
    -- Image has no user (kiosk mode) and belongs to user's event
    (user_id IS NULL AND EXISTS (
      SELECT 1 FROM events
      WHERE events.id = generated_images.event_id
      AND events.user_id = auth.uid()
    ))
    OR
    -- Image belongs to an event owned by the user
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = generated_images.event_id
      AND events.user_id = auth.uid()
    )
  );
