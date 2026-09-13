/*
# Add "show_account_promo" toggle to events

1. New Columns
- `events.show_account_promo` (boolean, NOT NULL, DEFAULT true)
  Controls whether the "Get Your Own Account Now" self-promotion block
  appears at the bottom of the kiosk sharing screen for this event.

2. Modified Tables
- `events` — added the new boolean column above.
  Existing rows are backfilled to `true` so all current events keep showing
  the promo until an organizer explicitly turns it off.

3. Security
- No RLS or policy changes. The column is read/written through the same
  existing event policies already in place.
*/

ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "show_account_promo" boolean NOT NULL DEFAULT true;

UPDATE "public"."events"
  SET "show_account_promo" = true
  WHERE "show_account_promo" IS NULL;
