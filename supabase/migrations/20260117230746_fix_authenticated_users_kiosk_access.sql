/*
  # Fix Authenticated Users Kiosk Access

  ## Problem
  Authenticated users cannot access other users' kiosks via passcode.
  The current RLS policy only allows authenticated users to view:
  - Events they own (user_id = auth.uid())
  - Events shared with them via event_access table
  - All events if they are an admin
  
  But it doesn't allow them to view active events (by passcode) like anonymous users can.

  ## Solution
  Update the events SELECT policy for authenticated users to include active events.
  This brings parity with anonymous users who can view any active event.

  ## Changes
  1. Drop the current "Users can view own, shared, or all if admin" policy
  2. Create new policy that adds: OR (is_active = true)
  
  ## Security
  - Only active events are accessible via this clause
  - Read-only access (SELECT only)
  - Maintains existing ownership and sharing restrictions for inactive events
*/

-- ============================================================================
-- Update authenticated users policy to include active events
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own, shared, or all if admin" ON events;

CREATE POLICY "Users can view own, shared, active, or all if admin"
  ON events
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM event_access
      WHERE event_access.event_id = events.id
      AND event_access.user_id = auth.uid()
    )
    OR
    is_active = true
    OR
    is_current_user_admin()
  );

COMMENT ON POLICY "Users can view own, shared, active, or all if admin" ON events IS
  'Allows authenticated users to view: (1) events they own, (2) events shared with them, (3) any active event (for kiosk mode), or (4) all events if admin';
