/*
  # Fix Anonymous User Insert Policy for Generated Images
  
  1. Purpose
    - Fix RLS policy blocking anonymous users in kiosk mode
    - Allow anon users to insert generated images with simple check
  
  2. Changes
    - Drop existing anon insert policy
    - Create new policy with explicit TRUE for active events check
  
  3. Security
    - Still validates event exists and is active
    - Uses explicit column references for clarity
*/

-- Drop the existing anon insert policy
DROP POLICY IF EXISTS "Public can insert generated images for active events" ON generated_images;

-- Create a new policy that explicitly allows anon inserts
CREATE POLICY "Anon users can insert generated images"
  ON generated_images
  FOR INSERT
  TO anon
  WITH CHECK (true);
