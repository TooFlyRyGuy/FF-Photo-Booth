/*
# Add customizable disclaimer feature to events

## Purpose
Adds per-event disclaimer support so organizers can show a customizable
acknowledgment screen to kiosk guests before they start their photo session.
Every guest acknowledgment is logged for compliance tracking.

## 1. Modified Tables
### `events`
- Added `disclaimer_enabled` (boolean, NOT NULL, default false): Whether the
  disclaimer screen is shown to guests after they press "Touch to Start".
- Added `disclaimer_text` (text, nullable): The customizable disclaimer text
  displayed to guests. A snapshot of this text is stored with each acknowledgment.

## 2. New Tables
### `disclaimer_acknowledgments`
Logs every guest disclaimer acknowledgment for compliance.
- `id` (uuid, primary key, auto-generated)
- `event_id` (uuid, NOT NULL, references events(id) ON DELETE CASCADE)
- `device_token` (text, nullable): Browser token identifying the device
- `ip_address` (text, nullable): IP address of the acknowledging device
- `disclaimer_text_snapshot` (text, NOT NULL): Exact disclaimer text shown at
  the time of agreement (preserves history even if the organizer later edits
  the disclaimer text)
- `acknowledged_at` (timestamptz, NOT NULL, default now()): When the guest agreed

## 3. Indexes
- `idx_disclaimer_acknowledgments_event_id` on `event_id` for fast per-event queries
- `idx_disclaimer_acknowledgments_acknowledged_at` on `acknowledged_at` for
  chronological sorting

## 4. Security (RLS)
- RLS enabled on `disclaimer_acknowledgments`.
- INSERT: `TO anon, authenticated` with `WITH CHECK (true)` — kiosk guests are
  not signed in, so anon inserts must be allowed. Any guest can log an
  acknowledgment; the data written is minimal and non-sensitive.
- SELECT/UPDATE/DELETE: `TO authenticated` only, scoped to event owners via
  subquery: `EXISTS (SELECT 1 FROM events WHERE events.id =
  disclaimer_acknowledgments.event_id AND events.user_id = auth.uid())`.
  Only the organizer who owns the event can view or manage acknowledgments.

## 5. Important Notes
1. The columns are added idempotently using DO $$ ... IF NOT EXISTS ... END $$
   blocks, so re-running this migration is safe.
2. Policies are dropped before creation to ensure idempotency.
3. The `disclaimer_text_snapshot` column intentionally stores a copy of the
   disclaimer text at acknowledgment time, so compliance records remain
   accurate even if the organizer edits the disclaimer later.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'disclaimer_enabled'
  ) THEN
    ALTER TABLE events ADD COLUMN disclaimer_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'disclaimer_text'
  ) THEN
    ALTER TABLE events ADD COLUMN disclaimer_text text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS disclaimer_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  device_token text,
  ip_address text,
  disclaimer_text_snapshot text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disclaimer_acknowledgments_event_id
  ON disclaimer_acknowledgments(event_id);

CREATE INDEX IF NOT EXISTS idx_disclaimer_acknowledgments_acknowledged_at
  ON disclaimer_acknowledgments(acknowledged_at);

ALTER TABLE disclaimer_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_disclaimer_acknowledgments" ON disclaimer_acknowledgments;
CREATE POLICY "anon_insert_disclaimer_acknowledgments"
ON disclaimer_acknowledgments FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "select_own_disclaimer_acknowledgments" ON disclaimer_acknowledgments;
CREATE POLICY "select_own_disclaimer_acknowledgments"
ON disclaimer_acknowledgments FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = disclaimer_acknowledgments.event_id
    AND events.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "update_own_disclaimer_acknowledgments" ON disclaimer_acknowledgments;
CREATE POLICY "update_own_disclaimer_acknowledgments"
ON disclaimer_acknowledgments FOR UPDATE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = disclaimer_acknowledgments.event_id
    AND events.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = disclaimer_acknowledgments.event_id
    AND events.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delete_own_disclaimer_acknowledgments" ON disclaimer_acknowledgments;
CREATE POLICY "delete_own_disclaimer_acknowledgments"
ON disclaimer_acknowledgments FOR DELETE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = disclaimer_acknowledgments.event_id
    AND events.user_id = auth.uid()
  )
);
