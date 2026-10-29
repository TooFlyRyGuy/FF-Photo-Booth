/*
# Add image_resolution column to events table

1. Changes
- Adds `image_resolution` (text, nullable) to the `events` table.
- When NULL, the event uses the global default resolution from `global_settings.gemini_resolution`.
- When set to '1K', '2K', or '4K', it overrides the global default for that specific event.
- This allows per-event control of AI image generation resolution.

2. Security
- No RLS policy changes needed — the existing event policies already govern access to the events table.
- The new column inherits the same RLS policies as the rest of the row.

3. Important Notes
- Existing events will have NULL for image_resolution, meaning they continue using the global default (no behavior change).
- The credit cost per photo scales with resolution: 1K = 1 credit, 2K = 2 credits, 4K = 4 credits.
- This is a non-destructive migration — only adds a nullable column.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'image_resolution'
  ) THEN
    ALTER TABLE events ADD COLUMN image_resolution text;
  END IF;
END $$;
