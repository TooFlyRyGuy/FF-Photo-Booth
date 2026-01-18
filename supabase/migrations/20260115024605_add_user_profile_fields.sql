/*
  # Add User Profile Management Fields
  
  1. Changes
    - Add `display_name` column to user_profiles for user's preferred display name
    - Add `profile_picture_url` column to user_profiles for avatar/profile picture
    - Add `bio` column for optional user bio
  
  2. Notes
    - display_name defaults to NULL, will fall back to full_name or email in UI
    - profile_picture_url stores URL to profile picture (can be Supabase storage or external)
    - All fields are optional and updatable by the user
*/

-- Add profile management fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN display_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'profile_picture_url'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN profile_picture_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN bio text;
  END IF;
END $$;

-- Create storage bucket for profile pictures if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for profile pictures
DO $$
BEGIN
  -- Allow authenticated users to upload their own profile pictures
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload own profile picture'
  ) THEN
    CREATE POLICY "Users can upload own profile picture"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'profile-pictures' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  -- Allow authenticated users to update their own profile pictures
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update own profile picture'
  ) THEN
    CREATE POLICY "Users can update own profile picture"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'profile-pictures' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  -- Allow authenticated users to delete their own profile pictures
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete own profile picture'
  ) THEN
    CREATE POLICY "Users can delete own profile picture"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'profile-pictures' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  -- Allow public read access to profile pictures
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Profile pictures are publicly accessible'
  ) THEN
    CREATE POLICY "Profile pictures are publicly accessible"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'profile-pictures');
  END IF;
END $$;