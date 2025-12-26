/*
  # Add Compressed Prompt Images

  1. Changes
    - Add `preview_image_compressed` column to `prompts` table
    - Add `reference_image_compressed` column to `prompts` table
    - These will store webp-compressed versions of the images for faster loading

  2. Notes
    - The compressed images will be significantly smaller than the original base64 images
    - Original images are preserved for backwards compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prompts' AND column_name = 'preview_image_compressed'
  ) THEN
    ALTER TABLE prompts ADD COLUMN preview_image_compressed text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prompts' AND column_name = 'reference_image_compressed'
  ) THEN
    ALTER TABLE prompts ADD COLUMN reference_image_compressed text;
  END IF;
END $$;