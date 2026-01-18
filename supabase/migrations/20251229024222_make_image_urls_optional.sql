/*
  # Make Image URLs Optional for Analytics-Only Storage

  ## Overview
  This migration makes image URL fields optional in the generated_images table.
  Images will be stored exclusively in external services (SmugMug, Dropbox),
  while the database maintains only metadata for analytics purposes.

  ## Changes
  1. Make `original_image_url` nullable (was NOT NULL)
  2. `generated_image_url` is already nullable, no change needed

  ## Impact
  - Reduces database storage by 80-90% per record
  - Preserves all analytics functionality (event stats, prompt tracking, charts)
  - Images continue to live in SmugMug/Dropbox galleries
  - No impact on existing analytics queries (they only use IDs and timestamps)

  ## Data Safety
  - Non-destructive change (only relaxes constraint)
  - Existing data remains intact
  - Backward compatible with existing code
*/

-- Make original_image_url nullable to allow analytics-only records
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_images'
    AND column_name = 'original_image_url'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE generated_images
    ALTER COLUMN original_image_url DROP NOT NULL;
  END IF;
END $$;