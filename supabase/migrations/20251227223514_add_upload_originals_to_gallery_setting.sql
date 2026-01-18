/*
  # Add Upload Originals to Gallery Setting

  1. Changes
    - Add `upload_originals_to_gallery` boolean column to events table
      - Controls whether original photos should be uploaded to SmugMug gallery
      - Defaults to false for backward compatibility
  
  2. Notes
    - When enabled, original photos will be uploaded to SmugMug gallery after AI generation
    - Requires SmugMug gallery to be configured for the event
    - Original photos are uploaded AFTER Gemini API processes the image
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'upload_originals_to_gallery'
  ) THEN
    ALTER TABLE events ADD COLUMN upload_originals_to_gallery boolean DEFAULT false;
  END IF;
END $$;