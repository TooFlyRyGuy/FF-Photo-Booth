/*
  # Add Gemini File URI tracking to prompts table

  1. New Columns
    - `gemini_file_uri` (text, nullable) - Stores the Gemini File API URI for the reference image
    - `gemini_file_uploaded_at` (timestamp with time zone, nullable) - Tracks when the file was uploaded
    - `gemini_file_expires_at` (timestamp with time zone, nullable) - Tracks when the file URI expires (48 hours from upload)
  
  2. Purpose
    - Cache Gemini File API URIs to avoid re-uploading reference images
    - Track expiration to refresh files before they expire
    - Improve performance by reusing uploaded files
*/

-- Add columns to prompts table
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS gemini_file_uri text,
ADD COLUMN IF NOT EXISTS gemini_file_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS gemini_file_expires_at timestamptz;

-- Add index on expiration time for cleanup queries
CREATE INDEX IF NOT EXISTS idx_prompts_gemini_file_expires_at 
ON prompts(gemini_file_expires_at) 
WHERE gemini_file_uri IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN prompts.gemini_file_uri IS 'Cached Gemini File API URI for the reference image';
COMMENT ON COLUMN prompts.gemini_file_uploaded_at IS 'Timestamp when the reference image was uploaded to Gemini File API';
COMMENT ON COLUMN prompts.gemini_file_expires_at IS 'Expiration time for the Gemini File API URI (typically 48 hours from upload)';
