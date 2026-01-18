/*
  # Fix Authenticated Users Access to Active Events

  1. Problem
    - Authenticated users could not view active events created by other users
    - The SELECT policy for authenticated users only allowed viewing own events or admin viewing all
    - This prevented logged-in users from accessing kiosk events via passcode

  2. Changes
    - Update SELECT policy for authenticated users on events table
    - Allow authenticated users to view active events (is_active = true)
    - Maintains security by still restricting inactive events to owner/admin

  3. Security
    - Users can view their own events (any status)
    - Users can view events with null user_id
    - Users can view any active event (is_active = true)
    - Admins can view all events
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Authenticated users can view own events, public events, or all " ON events;

-- Create new policy that allows viewing active events
CREATE POLICY "Authenticated users can view own events or active events or all if admin"
  ON events
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR user_id IS NULL 
    OR is_active = true
    OR is_current_user_admin()
  );
