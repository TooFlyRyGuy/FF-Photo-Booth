/*
  # Add processingText to events table

  Adds a `processing_text` column to the `events` table so event owners
  can customize the "Creating Magic..." label shown on the kiosk processing screen.

  1. Changes
    - `events`: add nullable `processing_text` text column (default NULL, falls back to "Creating Magic..." in the UI)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'processing_text'
  ) THEN
    ALTER TABLE events ADD COLUMN processing_text text;
  END IF;
END $$;
