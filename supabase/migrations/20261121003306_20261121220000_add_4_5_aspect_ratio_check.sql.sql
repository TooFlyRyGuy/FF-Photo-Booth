/*
# Add 4:5 aspect ratio to events constraint

1. Changes
- Drops the existing `events_aspect_ratio_check` constraint on `public.events`.
- Recreates it with the same allowed values plus '4:5' (Instagram portrait).
2. Security
- No RLS, policy, or grant changes — constraint-only migration.
*/

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_aspect_ratio_check;
ALTER TABLE public.events ADD CONSTRAINT events_aspect_ratio_check
  CHECK (aspect_ratio = ANY (ARRAY['square','3:4','4:3','9:16','16:9','2:3','3:2','4:5']));
