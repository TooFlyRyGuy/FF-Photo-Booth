-- Make the generated_images bucket public
UPDATE storage.buckets SET public = true WHERE name = 'generated_images';

-- Allow anon and authenticated users to upload (kiosk runs as anon)
CREATE POLICY "Allow generated image uploads"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'generated_images');

-- Public read access (bucket is public so this covers all)
CREATE POLICY "Public can read generated images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'generated_images');

-- Allow authenticated users (event owners) to delete their event's images
CREATE POLICY "Authenticated users can delete generated images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'generated_images');
