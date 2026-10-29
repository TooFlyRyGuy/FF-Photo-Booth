-- Fix: Allow admins and event-access holders to view tracked device usage.
-- Previously only the original event owner (events.user_id = auth.uid()) could read rows,
-- so admins and users granted event access saw an empty list.

DROP POLICY IF EXISTS "select_own_event_device_usage" ON event_device_usage;

CREATE POLICY "select_event_device_usage"
ON event_device_usage FOR SELECT
TO authenticated
USING (
  -- Event owner
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_device_usage.event_id
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
    WHERE event_access.event_id = event_device_usage.event_id
    AND event_access.user_id = auth.uid()
  )
);

-- Also allow admins and event-access holders to reset (delete) device usage
DROP POLICY IF EXISTS "delete_own_event_device_usage" ON event_device_usage;

CREATE POLICY "delete_event_device_usage"
ON event_device_usage FOR DELETE
TO authenticated
USING (
  -- Event owner
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_device_usage.event_id
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
    WHERE event_access.event_id = event_device_usage.event_id
    AND event_access.user_id = auth.uid()
  )
);