/*
  # Create Temporary Booth Images Storage Bucket

  1. Storage Configuration
    - Create new bucket `temp-booth-images` for temporary image storage
    - Configure as public bucket with read access
    - Set file size limit to 10MB
    - Allow MIME types: image/jpeg, image/png, image/webp
  
  2. Security
    - Enable RLS on bucket
    - Allow authenticated users to upload images
    - Allow public read access for all images
    - Allow users to delete their own images
  
  3. Purpose
    - Store user-captured images temporarily before Gemini processing
    - Store reference images for Gemini File API
    - Auto-cleanup handled by separate scheduled function
*/

-- Create the temp-booth-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'temp-booth-images',
  'temp-booth-images',
  true,
  10485760, -- 10MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload booth images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for booth images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own booth images" ON storage.objects;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload booth images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'temp-booth-images'
);

-- Allow public read access to all images
CREATE POLICY "Public read access for booth images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'temp-booth-images');

-- Allow users to delete their own booth images
CREATE POLICY "Users can delete their own booth images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'temp-booth-images' AND
  owner_id = auth.uid()::text
);
