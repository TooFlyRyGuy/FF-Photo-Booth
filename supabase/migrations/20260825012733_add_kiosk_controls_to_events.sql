/*
# Add kiosk control settings to events

1. New Columns on `events`
- `hide_language_selector` (boolean, default false) — when true, the language
  switcher is not shown on the kiosk attract screen; the kiosk stays in the
  default language.
- `default_kiosk_language` (text, nullable) — the language the kiosk starts in
  when it loads. Falls back to the first entry in `kiosk_languages`, then
  `kiosk_language`, then 'en-US'.
- `fullscreen_enabled` (boolean, default false) — when true, the kiosk enters
  fullscreen automatically on load and re-enters if a guest exits fullscreen.
  Replaces the old always-visible user-facing fullscreen toggle button.
- `kiosk_passcode` (text, nullable) — optional passcode required to exit the
  kiosk or exit fullscreen. When null/empty, no passcode is required (backward
  compatible).

2. Security
- No RLS changes. Existing event policies already govern access.
- `kiosk_passcode` is stored as-is on the event row (owner-only write via
  existing UPDATE policy; readable by anyone who can already read the event,
  which is required for the kiosk to function).

3. Important Notes
- All columns use IF NOT EXISTS guards so the migration is idempotent.
- No data is lost; existing rows get sensible defaults.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS hide_language_selector boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_kiosk_language text,
  ADD COLUMN IF NOT EXISTS fullscreen_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kiosk_passcode text;
