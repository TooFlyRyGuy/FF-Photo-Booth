/*
  # Revert Overly Permissive Events Policy

  1. Problem
    - Previous fix allowed all authenticated users to view all active events
    - This would show other users' events in their dashboard
    - Need to be more restrictive for dashboard while allowing kiosk access

  2. Changes
    - Revert to restrictive policy for authenticated users
    - Keep dashboard access limited to own events or admin
    - Kiosk mode (anon users) can still access active events via passcode

  3. Security
    - Authenticated users can only view own events (or admin views all)
    - Anonymous users can view active events (for kiosk mode)
*/

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view own events or active events or all if admin" ON events;

-- Restore the restrictive policy
CREATE POLICY "Authenticated users can view own events, public events, or all if admin"
  ON events
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR user_id IS NULL 
    OR is_current_user_admin()
  );
