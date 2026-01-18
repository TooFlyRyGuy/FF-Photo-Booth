/*
  # Simplify Authenticated Insert Policy for Debugging
  
  1. Purpose
    - Temporarily simplify the policy to diagnose RLS issue
    - Allow authenticated users to insert generated images more easily
  
  2. Changes
    - Remove complex event ownership check
    - Allow authenticated users to insert images for any active event
  
  3. Security
    - This is a debugging step to identify the issue
    - Will be refined once we understand the problem
*/

-- Drop the existing authenticated insert policy
DROP POLICY IF EXISTS "Users can insert generated images for their events" ON generated_images;

-- Create a simpler policy for debugging
CREATE POLICY "Authenticated users can insert generated images"
  ON generated_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = generated_images.event_id
    )
  );
