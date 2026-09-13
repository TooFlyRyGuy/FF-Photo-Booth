/*
# Add kioskLanguages array column to events

Adds a new text[] column `kiosk_languages` to the events table, allowing
multiple kiosk languages to be selected per event (multi-language support).

The existing `kiosk_language` text column is preserved for backward compatibility.
If `kiosk_languages` is null, the kiosk falls back to `kiosk_language` or 'en-US'.
*/

ALTER TABLE events ADD COLUMN IF NOT EXISTS kiosk_languages text[];
