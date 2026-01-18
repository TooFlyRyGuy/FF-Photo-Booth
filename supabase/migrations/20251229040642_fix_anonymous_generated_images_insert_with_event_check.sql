/*
  # Fix Anonymous User Image Generation

  ## Overview
  Allows anonymous users (kiosk mode) to insert generated images,
  but only for active events.

  ## Changes
  1. Drop the existing overly permissive anonymous INSERT policy
  2. Create a new policy that checks if the event is active

  ## Security
  - Anonymous users can only insert images for active events
  - Prevents image generation for inactive/ended events
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Anon users can insert generated images" ON generated_images;

-- Create a new policy that checks event is active
CREATE POLICY "Anon users can insert generated images for active events"
  ON generated_images FOR INSERT
  TO anon
  WITH CHECK (is_event_active(event_id));
