/*
  # Fix authenticated users accessing active events they don't own

  ## Problem
  The current events SELECT policy for authenticated users only allows access to:
  - Events they own (user_id = auth.uid())
  - Events they have explicit event_access grants for
  - All events if admin

  This means an authenticated user visiting another user's kiosk cannot load the
  event record at all, even though anonymous users CAN (via the anon active event policy).
  Authenticated users should be at least as permissive as anonymous users for active events.

  ## Changes
  - events: add active event branch to the authenticated SELECT policy so logged-in
    users can read any active event (same as anon already can)
*/

-- Drop the existing authenticated SELECT policy for events and replace it with one
-- that also allows reading active events (matching anon access level)
DROP POLICY IF EXISTS "Users can view own, shared, or all if admin" ON events;

CREATE POLICY "Users can view own, shared, active, or all if admin"
  ON events
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR is_active = true
    OR EXISTS (
      SELECT 1 FROM event_access
      WHERE event_access.event_id = events.id
        AND event_access.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
        AND user_profiles.role = 'admin'
    )
  );
