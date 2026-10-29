/*
# Fix Event Access Permissions and Secure Ownership Transfer

## Summary
This migration closes a data-leak in the events table SELECT policy that
allowed any logged-in user to see ALL active events (not just their own or
shared ones). It also adds missing INSERT/DELETE policies on event_access,
allows shared users to view event prompts, creates a secure server-side
function for ownership transfer, and revokes direct client access to the
user_id/created_by columns on events.

## 1. Events Table - Tighten Authenticated SELECT Policy
- The existing policy "Users can view own, shared, active, or all if admin"
  included `OR (is_active = true)` which leaked every active event to every
  logged-in user.
- Replace it with a policy that allows a logged-in user to see only:
  - Events they own (user_id = auth.uid()), OR
  - Events they were granted access to via event_access, OR
  - All events if they are an admin.
- The separate anon SELECT policy "Public can view active events" is kept
  unchanged so the Kiosk and other unauthenticated access continue to work.

## 2. Event Access Table - Add INSERT and DELETE Policies
- The event_access table previously had only a SELECT policy, meaning any
  authenticated user could grant or revoke access to any event (RLS was
  enabled but no INSERT/DELETE policies existed, so the table grants allowed
  all operations).
- Add INSERT policy: only the event owner or admin can grant access.
- Add DELETE policy: only the event owner or admin can revoke access.

## 3. Event Prompts Table - Allow Shared Users to View
- The existing SELECT policy allows anon/authenticated to view prompts for
  active events (for the Kiosk), plus owners and admins.
- Add a condition so authenticated users with an event_access row for the
  event can also view its prompts even when the event is not active.
- INSERT/UPDATE/DELETE policies remain owner-or-admin only (no change).

## 4. Secure Ownership Transfer Function
- Create a SECURITY DEFINER function `transfer_event_ownership` that:
  - Verifies the caller is the current owner of the event or an admin.
  - Updates the events.user_id to the new owner.
  - Removes any event_access row for the new owner (since they are now the
    owner, not a shared user).
  - Returns success or raises an exception.
- This replaces the previous client-side direct update of events.user_id.

## 5. Revoke Direct Client Access to user_id and created_by
- Revoke UPDATE privilege on events.user_id and events.created_by from both
  anon and authenticated roles, so a non-admin cannot reassign ownership
  directly via a client update.
- These columns are now only modifiable through the
  transfer_event_ownership function (which runs as SECURITY DEFINER).

## Important Notes
1. The anon SELECT policy on events is unchanged - kiosk mode continues to
   work for unauthenticated users.
2. The event_access SELECT policy is unchanged - users can still see their
   own access rows, admins can see all.
3. Existing event_prompts INSERT/UPDATE/DELETE policies are unchanged -
   shared users can view prompts but cannot edit them.
4. The transfer_event_ownership function has a fixed search_path for security.
*/

-- =====================================================
-- 1. Events Table - Tighten Authenticated SELECT Policy
-- =====================================================

DROP POLICY IF EXISTS "Users can view own, shared, active, or all if admin" ON events;

CREATE POLICY "Users can view own, shared, or all if admin"
ON events FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid())
  OR (EXISTS (
    SELECT 1 FROM event_access
    WHERE event_access.event_id = events.id
      AND event_access.user_id = auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
  ))
);

-- =====================================================
-- 2. Event Access Table - Add INSERT and DELETE Policies
-- =====================================================

DROP POLICY IF EXISTS "Owners can grant event access" ON event_access;
CREATE POLICY "Owners can grant event access"
ON event_access FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_access.event_id
      AND (events.user_id = auth.uid() OR user_is_admin())
  )
);

DROP POLICY IF EXISTS "Owners can revoke event access" ON event_access;
CREATE POLICY "Owners can revoke event access"
ON event_access FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_access.event_id
      AND (events.user_id = auth.uid() OR user_is_admin())
  )
);

-- =====================================================
-- 3. Event Prompts Table - Allow Shared Users to View
-- =====================================================

DROP POLICY IF EXISTS "Select event prompts" ON event_prompts;

CREATE POLICY "Select event prompts"
ON event_prompts FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_prompts.event_id
      AND (
        e.is_active = true
        OR e.user_id = auth.uid()
        OR e.created_by = auth.uid()
        OR user_is_admin()
        OR EXISTS (
          SELECT 1 FROM event_access ea
          WHERE ea.event_id = e.id
            AND ea.user_id = auth.uid()
        )
      )
  )
);

-- =====================================================
-- 4. Secure Ownership Transfer Function
-- =====================================================

CREATE OR REPLACE FUNCTION public.transfer_event_ownership(
  p_event_id uuid,
  p_new_owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_owner uuid;
  v_is_admin boolean;
BEGIN
  -- Get current owner
  SELECT user_id INTO v_current_owner
  FROM events
  WHERE id = p_event_id;

  IF v_current_owner IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Check if caller is admin
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  ) INTO v_is_admin;

  -- Verify caller is the current owner or an admin
  IF v_current_owner != auth.uid() AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Only the event owner or an admin can transfer ownership';
  END IF;

  -- Prevent transferring to the current owner (no-op)
  IF v_current_owner = p_new_owner_id THEN
    RETURN;
  END IF;

  -- Update the event owner
  UPDATE events
  SET user_id = p_new_owner_id,
      updated_at = now()
  WHERE id = p_event_id;

  -- Remove any event_access row for the new owner (they own it now)
  DELETE FROM event_access
  WHERE event_id = p_event_id
    AND user_id = p_new_owner_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_event_ownership(uuid, uuid) TO authenticated;

-- =====================================================
-- 5. Revoke Direct Client Access to user_id and created_by
-- =====================================================

-- Revoke UPDATE on user_id and created_by from anon and authenticated
-- so ownership can only be changed via the transfer_event_ownership function
REVOKE UPDATE (user_id) ON events FROM anon, authenticated;
REVOKE UPDATE (created_by) ON events FROM anon, authenticated;
