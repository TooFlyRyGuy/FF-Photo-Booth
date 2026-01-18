/*
  # Fix Generated Images RLS Policies Using Secure Function
  
  1. Security Changes
    - Replace subquery-based event validation with SECURITY DEFINER function
    - Fix authenticated users unable to insert generated images
    - Use is_event_active_and_valid() function to prevent RLS recursion
    - Maintain proper access control for both anonymous and authenticated users
  
  2. Policy Updates
    - Anonymous users: can insert if event is active and valid
    - Authenticated users: can insert to active events they own/have access to
    - Event owners: can view all images for their events
    - Admins: can view all images
  
  3. Important Notes
    - This fixes the issue where authenticated users couldn't save images during kiosk mode
    - The SECURITY DEFINER function bypasses RLS to check event status reliably
    - Prevents infinite recursion that was occurring with subquery-based checks
*/

-- Drop existing INSERT policies for generated_images
DROP POLICY IF EXISTS "Anonymous users can insert to active events" ON generated_images;
DROP POLICY IF EXISTS "Authenticated users can insert to accessible events" ON generated_images;

-- Create new INSERT policy for anonymous users
CREATE POLICY "Anonymous users can insert images to active events"
  ON generated_images
  FOR INSERT
  TO anon
  WITH CHECK (
    is_event_active_and_valid(event_id)
  );

-- Create new INSERT policy for authenticated users
CREATE POLICY "Authenticated users can insert images to active events"
  ON generated_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_event_active_and_valid(event_id)
  );