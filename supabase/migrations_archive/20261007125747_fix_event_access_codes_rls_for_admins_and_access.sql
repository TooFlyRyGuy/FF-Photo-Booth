/*
# Fix QR Access Codes RLS for Admins and Event-Access Holders

## Problem
The `event_access_codes` table's SELECT and DELETE policies only allowed
the original event owner (`events.user_id = auth.uid()`) to view and
manage QR access codes. If an event's ownership was transferred, or if a
user was granted event access (via the event_access table), they could
open the "Manage QR Codes" modal but the query returned zero codes --
the codes existed in the database but were invisible to them.

This is the same bug that was fixed for `event_device_usage` in migration
20260930032225, but that fix was never applied to `event_access_codes`.

## Changes
1. Replace the SELECT policy on `event_access_codes` to allow:
   - The event owner (events.user_id = auth.uid())
   - Admins (user_profiles.role = 'admin')
   - Users granted event access (event_access.user_id = auth.uid())
2. Replace the DELETE policy with the same expanded access list.
3. The INSERT policy is also expanded so admins and event-access holders
   can generate codes, not just the original owner.

## Security
- RLS remains enabled on `event_access_codes`.
- UPDATE is still NOT granted to anon or authenticated (unchanged) --
  only the service role via the edge function can mark codes as used.
- All three policies (SELECT, INSERT, DELETE) now use the same
  ownership OR admin OR event-access check, consistent with how
  event_device_usage and events themselves work.
*/

-- =====================================================
-- 1. SELECT: Allow owner, admins, and event-access holders
-- =====================================================
DROP POLICY IF EXISTS "select_own_event_access_codes" ON event_access_codes;

CREATE POLICY "select_event_access_codes"
ON event_access_codes FOR SELECT
TO authenticated
USING (
  -- Event owner
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_access_codes.event_id
    AND events.user_id = auth.uid()
  )
  -- Admins
  OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND lower(user_profiles.role) = 'admin'
  )
  -- Users granted event access
  OR EXISTS (
    SELECT 1 FROM event_access
    WHERE event_access.event_id = event_access_codes.event_id
    AND event_access.user_id = auth.uid()
  )
);

-- =====================================================
-- 2. INSERT: Allow owner, admins, and event-access holders
-- =====================================================
DROP POLICY IF EXISTS "insert_own_event_access_codes" ON event_access_codes;

CREATE POLICY "insert_event_access_codes"
ON event_access_codes FOR INSERT
TO authenticated
WITH CHECK (
  -- Event owner
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_access_codes.event_id
    AND events.user_id = auth.uid()
  )
  -- Admins
  OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND lower(user_profiles.role) = 'admin'
  )
  -- Users granted event access
  OR EXISTS (
    SELECT 1 FROM event_access
    WHERE event_access.event_id = event_access_codes.event_id
    AND event_access.user_id = auth.uid()
  )
);

-- =====================================================
-- 3. DELETE: Allow owner, admins, and event-access holders
-- =====================================================
DROP POLICY IF EXISTS "delete_own_event_access_codes" ON event_access_codes;

CREATE POLICY "delete_event_access_codes"
ON event_access_codes FOR DELETE
TO authenticated
USING (
  -- Event owner
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_access_codes.event_id
    AND events.user_id = auth.uid()
  )
  -- Admins
  OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND lower(user_profiles.role) = 'admin'
  )
  -- Users granted event access
  OR EXISTS (
    SELECT 1 FROM event_access
    WHERE event_access.event_id = event_access_codes.event_id
    AND event_access.user_id = auth.uid()
  )
);
