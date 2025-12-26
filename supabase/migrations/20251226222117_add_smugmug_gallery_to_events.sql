/*
  # Add SmugMug Gallery Integration to Events

  ## Changes
  - Add `smugmug_gallery_key` column to events table to store the SmugMug gallery identifier
  - Add `smugmug_gallery_url` column to events table to store the public SmugMug gallery URL
  
  ## Purpose
  This migration enables automatic SmugMug gallery creation for each event, allowing
  generated photos to be uploaded directly to SmugMug and shared via SMS.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'smugmug_gallery_key'
  ) THEN
    ALTER TABLE events ADD COLUMN smugmug_gallery_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'smugmug_gallery_url'
  ) THEN
    ALTER TABLE events ADD COLUMN smugmug_gallery_url text;
  END IF;
END $$;