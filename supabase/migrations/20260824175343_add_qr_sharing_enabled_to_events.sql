/*
# Add QR sharing enabled column to events

1. Changes
- Adds a new `qr_sharing_enabled` boolean column to the `events` table.
- Defaults to `true` so existing events keep showing the QR code on the kiosk sharing screen.
- This column controls whether the QR code box appears on the kiosk sharing/result screen.

2. Security
- No RLS policy changes. The column is readable by the same roles that already read events.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS qr_sharing_enabled boolean NOT NULL DEFAULT true;
