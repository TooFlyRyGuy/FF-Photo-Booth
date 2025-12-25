/*
  # SmugMug Integration - OAuth & Gallery Management

  1. Schema Changes
    - Add SmugMug OAuth credentials to global_settings
      - `smugmug_oauth_token` - OAuth 1.0a token
      - `smugmug_oauth_token_secret` - OAuth 1.0a token secret
      - `smugmug_user_nickname` - Authorized SmugMug account nickname
      - `smugmug_connection_status` - Connection status (connected, disconnected, needs_attention)
      - `smugmug_last_auth_date` - Last successful authorization timestamp
      - `smugmug_default_visibility` - Default gallery visibility (public or private)
      - `use_smugmug_for_sms` - Boolean to use SmugMug links in SMS (default true)

    - Add SmugMug gallery fields to events table
      - `smugmug_gallery_id` - SmugMug gallery ID
      - `smugmug_gallery_url` - Public gallery URL
      - `smugmug_gallery_visibility` - Gallery visibility (public or private)
      - `smugmug_gallery_name` - Gallery name

  2. Security
    - OAuth tokens are only accessible to admins
    - Gallery URLs are accessible to event viewers

  3. Notes
    - SmugMug OAuth uses OAuth 1.0a protocol
    - Tokens remain valid indefinitely unless revoked
    - Connection is application-wide (single account)
*/

-- Add SmugMug OAuth fields to global_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'smugmug_oauth_token'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN smugmug_oauth_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'smugmug_oauth_token_secret'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN smugmug_oauth_token_secret text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'smugmug_user_nickname'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN smugmug_user_nickname text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'smugmug_connection_status'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN smugmug_connection_status text DEFAULT 'disconnected';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'smugmug_last_auth_date'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN smugmug_last_auth_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'smugmug_default_visibility'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN smugmug_default_visibility text DEFAULT 'private';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'use_smugmug_for_sms'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN use_smugmug_for_sms boolean DEFAULT true;
  END IF;
END $$;

-- Add SmugMug gallery fields to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'smugmug_gallery_id'
  ) THEN
    ALTER TABLE events ADD COLUMN smugmug_gallery_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'smugmug_gallery_url'
  ) THEN
    ALTER TABLE events ADD COLUMN smugmug_gallery_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'smugmug_gallery_visibility'
  ) THEN
    ALTER TABLE events ADD COLUMN smugmug_gallery_visibility text DEFAULT 'private';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'smugmug_gallery_name'
  ) THEN
    ALTER TABLE events ADD COLUMN smugmug_gallery_name text;
  END IF;
END $$;

-- Add index for faster SmugMug gallery lookups
CREATE INDEX IF NOT EXISTS idx_events_smugmug_gallery_id ON events(smugmug_gallery_id);

-- Add upload queue table for failed SmugMug uploads
CREATE TABLE IF NOT EXISTS smugmug_upload_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_image_id uuid REFERENCES generated_images(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  upload_status text DEFAULT 'pending',
  retry_count int DEFAULT 0,
  last_attempt_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE smugmug_upload_queue ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage upload queue
CREATE POLICY "Admins can view upload queue"
  ON smugmug_upload_queue FOR SELECT
  TO authenticated
  USING (user_is_admin());

CREATE POLICY "Admins can update upload queue"
  ON smugmug_upload_queue FOR UPDATE
  TO authenticated
  USING (user_is_admin())
  WITH CHECK (user_is_admin());

-- System can insert into upload queue
CREATE POLICY "System can insert upload queue"
  ON smugmug_upload_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add indexes for upload queue
CREATE INDEX IF NOT EXISTS idx_smugmug_upload_queue_status ON smugmug_upload_queue(upload_status);
CREATE INDEX IF NOT EXISTS idx_smugmug_upload_queue_event ON smugmug_upload_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_smugmug_upload_queue_created ON smugmug_upload_queue(created_at);
