/*
# Add gallery_enabled toggle to events

1. New Columns
- `events.gallery_enabled` (boolean, NOT NULL, default false): When true, the
  kiosk sharing station shows a "View Event Gallery" button that opens the
  event's connected SmugMug gallery in a new tab so guests can browse all
  photos from the event.

2. Modified Tables
- `events`: adds the new column with a safe default so existing events keep
  their current behavior (gallery hidden) until an organizer opts in.

3. Security
- No RLS policy changes. The column is read and written through the existing
  events RLS policies already in place.

4. Important Notes
- Defaults to false so no current event changes behavior until an organizer
  explicitly enables it.
- The toggle is only meaningful when a SmugMug gallery is connected
  (smugmug_gallery_url is set); the UI hides the toggle otherwise.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS gallery_enabled boolean NOT NULL DEFAULT false;
