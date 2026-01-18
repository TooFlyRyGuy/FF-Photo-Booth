/*
  # Fix Admin Access to All Events

  ## Problem
  After migration 20251230193935, admins lost the ability to see all events in the system.
  The policy "Authenticated users can view own events or all if admin" was dropped,
  leaving only the policy that checks ownership OR event_access table.

  This means admins can only see:
  - Events they personally own
  - Events explicitly shared with them via event_access table

  When an admin transfers event ownership, they immediately lose visibility of that event.

  ## Solution
  Update the events SELECT policy to include the admin check using is_current_user_admin().

  ## Changes
  1. Drop the current policy "Users can view their own or shared events"
  2. Create new policy "Users can view own, shared, or all if admin" that includes:
     - Events owned by the user (user_id = auth.uid())
     - OR Events shared with the user (EXISTS in event_access)
     - OR User is an admin (is_current_user_admin())

  ## Expected Behavior After Fix
  - Admins: Can see ALL events in the system (regardless of owner)
  - Regular users: Can only see events they own or have been granted access to
  - Event ownership transfers: Admins retain visibility even after transferring ownership
*/

-- ============================================================================
-- Drop existing policy and create comprehensive policy with admin check
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own or shared events" ON events;

CREATE POLICY "Users can view own, shared, or all if admin"
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
    is_current_user_admin()
  );

-- ============================================================================
-- Add comment explaining the policy logic
-- ============================================================================

COMMENT ON POLICY "Users can view own, shared, or all if admin" ON events IS
  'Allows users to view events they own, events shared with them via event_access table, or all events if they are an admin. This ensures admins maintain system-wide visibility even after transferring event ownership.';
