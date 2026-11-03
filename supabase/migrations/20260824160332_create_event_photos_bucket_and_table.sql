/*
# Create event-photos storage bucket and event_photos tracking table

1. Storage Bucket
  - Create a new public storage bucket `event-photos` for permanent storage
    of AI-generated photos.
  - Public read access (anyone can download photos without authentication).
  - Anonymous + authenticated upload access (kiosk guests are not signed in).
  - 10MB file size limit, image MIME types only.

2. New Table: event_photos
  - id (uuid, primary key)
  - event_id (uuid, foreign key to events, indexed) — which event the photo belongs to
  - prompt_id (uuid, foreign key to prompts) — which prompt was used
  - storage_path (text) — path within the event-photos bucket
  - public_url (text) — public download URL from the bucket
  - smugmug_url (text, nullable) — SmugMug URL once background upload completes
  - created_at (timestamptz, default now)

3. Security
  - RLS enabled on event_photos.
  - Public SELECT (TO anon, authenticated) so the future gallery page can list
    photos for an event without sign-in.
  - Public INSERT (TO anon, authenticated) so the kiosk can create records.
  - No UPDATE or DELETE policies (records are write-once from the kiosk).

4. Purpose
  - Stores every AI-generated photo in our own Supabase storage, organized by
    event ID in the folder structure: {event-id}/filename.jpg
  - The event_photos table is the data source for a future built-in gallery
    page, filterable by event.
*/

-- Create the event-photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-photos',
  'event-photos',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for event-photos bucket
DROP POLICY IF EXISTS "Allow event-photo uploads for all users" ON storage.objects;
CREATE POLICY "Allow event-photo uploads for all users"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'event-photos');

DROP POLICY IF EXISTS "Public read access for event-photos" ON storage.objects;
CREATE POLICY "Public read access for event-photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'event-photos');

-- Create event_photos table
CREATE TABLE IF NOT EXISTS event_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  smugmug_url text,
  created_at timestamptz DEFAULT now()
);

-- Index for querying photos by event (gallery page)
CREATE INDEX IF NOT EXISTS idx_event_photos_event_id ON event_photos(event_id);
CREATE INDEX IF NOT EXISTS idx_event_photos_created_at ON event_photos(created_at DESC);

-- Enable RLS
ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;

-- Public SELECT: gallery page and kiosk can read without sign-in
DROP POLICY IF EXISTS "Public can read event photos" ON event_photos;
CREATE POLICY "Public can read event photos"
ON event_photos FOR SELECT
TO anon, authenticated
USING (true);

-- Public INSERT: kiosk (anonymous) can create photo records
DROP POLICY IF EXISTS "Public can insert event photos" ON event_photos;
CREATE POLICY "Public can insert event photos"
ON event_photos FOR INSERT
TO anon, authenticated
WITH CHECK (true);
