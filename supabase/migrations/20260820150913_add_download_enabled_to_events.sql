/*
# Add download_enabled column to events

1. Changes
- Adds `download_enabled` boolean column to the `events` table, defaulting to `true`.
- This lets organizers hide the "Download to Device" button on the kiosk sharing screen on a per-event basis.
- Existing events keep download available (default true).
2. Security
- No RLS policy changes. Existing event policies already govern read/write access.
3. Notes
- The column is nullable-safe in app code: treated as enabled when null or true.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS download_enabled boolean NOT NULL DEFAULT true;
