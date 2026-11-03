/*
# Add logo position and size columns to events table

1. Purpose
   Organizers can now choose where the kiosk logo appears on the attract screen
   and how large it is. Previously the logo was hardcoded to the top-left corner
   at a single fixed size.

2. New Columns on `events`
   - `logo_position` (text, default 'top-left')
       Controls horizontal placement of the logo on the kiosk screen.
       Allowed values: 'top-left', 'center', 'top-right'.
   - `logo_size` (text, default 'medium')
       Controls the display height of the logo image.
       Allowed values: 'small', 'medium', 'large', 'extra-large'.

3. Security
   No RLS policy changes — these columns are covered by the existing
   event-level ownership policies already in place.

4. Notes
   - Both columns are nullable-safe with sensible defaults so existing events
     retain their current top-left / medium appearance without any data migration.
   - No data is lost; this is a purely additive ALTER TABLE.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'logo_position'
  ) THEN
    ALTER TABLE events ADD COLUMN logo_position text NOT NULL DEFAULT 'top-left';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'logo_size'
  ) THEN
    ALTER TABLE events ADD COLUMN logo_size text NOT NULL DEFAULT 'medium';
  END IF;
END $$;
