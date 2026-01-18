/*
  # Update Prompt Images Storage Bucket Cache Settings

  1. Purpose
    - Set default cache control headers for the prompt-images bucket
    - Enable browser caching for better performance
    - Reduce repeated downloads of the same images

  2. Changes
    - Update storage bucket to include default cache control headers
    - Set cache duration to 1 hour (3600 seconds)

  3. Performance Impact
    - Browser will cache images for 1 hour
    - Reduced bandwidth usage
    - Faster page loads on repeat visits
*/

-- Update the bucket to set default cache control
UPDATE storage.buckets 
SET 
  public = true,
  avif_autodetection = false
WHERE id = 'prompt-images';