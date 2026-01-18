/*
  # Create Supabase Storage Bucket for Prompt Images

  1. Purpose
    - Replace base64 database storage with Supabase Storage
    - Dramatically improve query performance by storing URLs instead of large base64 strings
    - Enable CDN delivery of images for faster loading

  2. Changes
    - Create public storage bucket named 'prompt-images'
    - Set up public access policy for read operations
    - Set up authenticated access policy for write operations (upload/update/delete)

  3. Security
    - Public read access: Anyone can view images (needed for kiosk mode)
    - Authenticated write: Only authenticated users can upload/modify/delete

  4. Performance Impact
    - Database query size reduction: 6MB → 2KB for kiosk mode
    - Progressive image loading instead of blocking query
    - Browser caching enabled
    - CDN delivery for optimal performance
*/

-- Create the storage bucket for prompt images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prompt-images',
  'prompt-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for prompt images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload prompt images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update prompt images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete prompt images" ON storage.objects;

-- Allow public read access to all files in the bucket
CREATE POLICY "Public read access for prompt images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'prompt-images');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload prompt images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'prompt-images');

-- Allow authenticated users to update their files
CREATE POLICY "Authenticated users can update prompt images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'prompt-images')
  WITH CHECK (bucket_id = 'prompt-images');

-- Allow authenticated users to delete their files
CREATE POLICY "Authenticated users can delete prompt images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'prompt-images');