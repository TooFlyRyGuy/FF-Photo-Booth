/*
  # Fix Authenticated Users Insert Policy for Generated Images

  ## Problem
  The current authenticated insert policy checks if an event exists, but that check is subject to RLS on the events table. Authenticated users can only see their own events or public events, causing the policy to fail when trying to insert images for events owned by other users.

  ## Changes
  - Drop the existing authenticated insert policy
  - Create a new policy that allows inserting for any active event using a security definer function
  - This allows authenticated users to use the kiosk for any active event

  ## Security
  - Still restricted to active events only
  - Users can only create generated images, not modify or delete them
  - Event validation happens through security definer function that bypasses RLS
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Authenticated users can insert generated images" ON generated_images;

-- Create a security definer function to check if event is active
CREATE OR REPLACE FUNCTION is_event_active(event_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT is_active FROM events WHERE id = event_uuid;
$$;

-- Create new policy that allows inserting for any active event
CREATE POLICY "Authenticated users can insert generated images"
  ON generated_images
  FOR INSERT
  TO authenticated
  WITH CHECK (is_event_active(event_id));