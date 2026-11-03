/*
# Remove duplicate anon_read_active_events RLS policy

## Purpose
The events table has two identical permissive SELECT policies that both
allow anyone (including anon) to read all active events:
  1. "Public can view active events" — is_active = true
  2. "anon_read_active_events" — is_active = true

Both are needed for kiosk mode (guests load an event by passcode without
being logged in), but having two identical policies is redundant. The
client-side filter in getEvents() now ensures non-admin users only see
their own + shared events in the dashboard, so the duplicate policy can
be safely removed.

## Changes
- Drop the "anon_read_active_events" SELECT policy (duplicate of
  "Public can view active events").
- Keep "Public can view active events" so kiosk mode continues to work.
- Keep "Users can view own, shared, or all if admin" for authenticated
  dashboard access.

## Security
No security regression: the remaining "Public can view active events"
policy provides the same kiosk access. The client-side filter in
getEvents() ensures non-admin users only see their own and shared
events in the dashboard.
*/

DROP POLICY IF EXISTS "anon_read_active_events" ON events;