/*
# Add timezone column to events table

## Purpose
Each event currently relies on the event owner's profile timezone to interpret
and display start/end times. When an admin or another user views the event, the
timezone context is lost, causing displayed times to be wrong and the kiosk
lock/unlock logic to potentially trigger at the wrong moment.

This migration stores the IANA timezone string (e.g. "America/New_York")
directly on each event row so every viewer sees times in the event's own
timezone.

## Changes
- Adds `timezone` column (text, NOT NULL, default 'UTC') to the `events` table.
- Backfills existing rows from the owning user's profile timezone where
  available, falling back to 'UTC'.

## Security
- No RLS policy changes. The column is readable/writable by anyone who already
  has event access (existing event policies cover it).
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

-- Backfill from user profiles where possible
UPDATE events e
SET timezone = COALESCE(
  (SELECT p.timezone FROM user_profiles p WHERE p.id = e.user_id),
  'UTC'
)
WHERE e.timezone = 'UTC'
  AND e.user_id IS NOT NULL;
