/*
  # Simplify Generated Images RLS Policy

  ## Overview
  Simplifies the SELECT policy by removing redundant condition.
  The policy now simply allows users to see images they created OR images
  from events they own.

  ## Changes
  1. Drop the existing policy
  2. Create a simpler, more efficient policy

  ## Security
  - Same security level as before
  - More efficient query execution
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can read generated images from own events" ON generated_images;

-- Create a simplified policy
CREATE POLICY "Users can read generated images from own events"
  ON generated_images FOR SELECT
  TO authenticated
  USING (
    -- User created the image
    user_id = auth.uid()
    OR
    -- Image belongs to an event owned by the user
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = generated_images.event_id
      AND events.user_id = auth.uid()
    )
  );
