/*
# Create kiosk_text_overrides table

1. Purpose
   Allows event organizers to customize the text shown on the kiosk screen
   (e.g. "TAP TO START", "AI Photo Experience", "Choose Your Style") per event
   and per language. Overrides are stored in the database so they persist and
   can be edited through the Language Settings panel.

2. New Tables
   - `kiosk_text_overrides`
     - `id` (uuid, primary key)
     - `event_id` (uuid, foreign key to events, ON DELETE CASCADE)
     - `language_code` (text, not null) — e.g. 'es', 'fr', 'de'
     - `text_key` (text, not null) — the i18n key, e.g. 'kiosk.tapToStart'
     - `text_value` (text, not null) — the custom translated text
     - `created_at` (timestamptz, default now())
     - `updated_at` (timestamptz, default now())
   - Unique constraint on (event_id, language_code, text_key) so each key
     has at most one override per event per language.

3. Security
   - Enable RLS on `kiosk_text_overrides`.
   - SELECT: The event owner can read their overrides. Anon can also read,
     so the kiosk (which uses the anon key) can load overrides for the active event.
   - INSERT/UPDATE/DELETE: Only the event owner (authenticated) can modify overrides.
     Ownership is verified through the events table: events.user_id = auth.uid().

4. Indexes
   - Index on (event_id, language_code) for fast lookups when the kiosk loads.
*/

CREATE TABLE IF NOT EXISTS kiosk_text_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  text_key text NOT NULL,
  text_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (event_id, language_code, text_key)
);

ALTER TABLE kiosk_text_overrides ENABLE ROW LEVEL SECURITY;

-- SELECT: event owner + anon (kiosk uses anon key)
DROP POLICY IF EXISTS "select_kiosk_text_overrides" ON kiosk_text_overrides;
CREATE POLICY "select_kiosk_text_overrides"
ON kiosk_text_overrides FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = kiosk_text_overrides.event_id
    AND (events.user_id = auth.uid() OR true)
  )
);

-- INSERT: only event owner
DROP POLICY IF EXISTS "insert_kiosk_text_overrides" ON kiosk_text_overrides;
CREATE POLICY "insert_kiosk_text_overrides"
ON kiosk_text_overrides FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = kiosk_text_overrides.event_id
    AND events.user_id = auth.uid()
  )
);

-- UPDATE: only event owner
DROP POLICY IF EXISTS "update_kiosk_text_overrides" ON kiosk_text_overrides;
CREATE POLICY "update_kiosk_text_overrides"
ON kiosk_text_overrides FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = kiosk_text_overrides.event_id
    AND events.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = kiosk_text_overrides.event_id
    AND events.user_id = auth.uid()
  )
);

-- DELETE: only event owner
DROP POLICY IF EXISTS "delete_kiosk_text_overrides" ON kiosk_text_overrides;
CREATE POLICY "delete_kiosk_text_overrides"
ON kiosk_text_overrides FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = kiosk_text_overrides.event_id
    AND events.user_id = auth.uid()
  )
);

-- Index for fast lookups by event + language
CREATE INDEX IF NOT EXISTS idx_kiosk_text_overrides_event_lang
ON kiosk_text_overrides(event_id, language_code);
