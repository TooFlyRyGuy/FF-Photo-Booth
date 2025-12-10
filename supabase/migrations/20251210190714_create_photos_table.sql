/*
  # Fun Frame AI Booth Database Schema

  ## Overview
  Creates the database schema for the Fun Frame AI Booth application, which allows users to take photos
  and apply fun AI-generated frames and effects.

  ## New Tables
  
  ### `photos`
  Stores metadata about captured photos from the photo booth.
  
  - `id` (uuid, primary key) - Unique identifier for each photo
  - `created_at` (timestamptz) - Timestamp when the photo was captured
  - `file_path` (text) - Path to the photo file in Supabase Storage
  - `frame_style` (text) - The frame/filter style applied to the photo
  - `thumbnail_path` (text, nullable) - Path to thumbnail version of the photo
  - `session_id` (uuid, nullable) - Groups photos from the same booth session
  
  ## Storage
  
  Creates a public storage bucket named `photo-booth` for storing photo files.
  
  ## Security
  
  - Enables Row Level Security (RLS) on the `photos` table
  - Creates a public read policy allowing anyone to view photos (photo booth is public)
  - Creates a public insert policy allowing anyone to create photos (photo booth is public)
  - Storage bucket is configured as public for easy photo sharing and display
  
  ## Notes
  
  This is a public photo booth application, so we allow public access to photos.
  In a production environment with user accounts, you would restrict access based on auth.uid().
*/

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  file_path text NOT NULL,
  frame_style text NOT NULL DEFAULT 'classic',
  thumbnail_path text,
  session_id uuid
);

-- Enable Row Level Security
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (photo booth is public)
CREATE POLICY "Anyone can view photos"
  ON photos
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert photos"
  ON photos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('photo-booth', 'photo-booth', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for public access
CREATE POLICY "Anyone can view photo booth images"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'photo-booth');

CREATE POLICY "Anyone can upload photo booth images"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'photo-booth');

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS photos_created_at_idx ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS photos_session_id_idx ON photos(session_id);