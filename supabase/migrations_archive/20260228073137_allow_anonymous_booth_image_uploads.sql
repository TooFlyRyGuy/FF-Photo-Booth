/*
  # Allow Anonymous Users to Upload Booth Images

  1. Changes
    - Update storage policy to allow anonymous (unauthenticated) users to upload images to temp-booth-images bucket
    - This enables Kiosk mode photo capture for guests without authentication
    
  2. Security
    - File size limit remains at 10MB
    - MIME type restrictions remain (image/jpeg, image/png, image/webp)
    - Public read access unchanged
    - Authenticated users can still delete their own images
    - Anonymous users can upload but cannot delete (no owner_id)
    
  3. Purpose
    - Enable photo booth kiosk functionality for unauthenticated users
    - Allow event attendees to capture and generate photos without login
*/

-- Drop the existing authenticated-only upload policy
DROP POLICY IF EXISTS "Authenticated users can upload booth images" ON storage.objects;

-- Create new policy allowing both authenticated and anonymous users to upload
CREATE POLICY "Allow booth image uploads for all users"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'temp-booth-images'
);
