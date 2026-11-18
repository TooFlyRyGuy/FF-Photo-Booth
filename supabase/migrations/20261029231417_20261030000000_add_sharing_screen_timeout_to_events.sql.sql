/*
# Add sharing_screen_timeout column to events table

1. Purpose
   The kiosk delivery/sharing screen currently auto-returns to the start screen
   after a hardcoded 15 seconds. This migration adds a configurable per-event
   setting so organizers can control how long the sharing/delivery screen stays
   visible before the kiosk resets.

2. Changes
   - Adds `sharing_screen_timeout` integer column to the `events` table.
   - Default value is 15 (seconds), preserving the existing behavior for all
     current events.
   - Nullable so legacy rows that predate the column get the default via
     COALESCE in application code; the column default covers new inserts.

3. Security
   - No changes to RLS policies or grants. The column is readable/writable by
     the same roles that already have access to the `events` table.
*/

ALTER TABLE events ADD COLUMN IF NOT EXISTS sharing_screen_timeout integer DEFAULT 15;
