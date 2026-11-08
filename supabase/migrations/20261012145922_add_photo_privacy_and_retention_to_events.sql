/*
# Add Photo Privacy Mode and Retention Settings to Events

## Purpose
Gives event organizers three new per-event controls:
1. Private sharing mode -- guests receive a direct link to only their own overlaid photo instead of the full SmugMug gallery.
2. Skip clean version -- saves only the final overlaid photo to storage, avoiding duplicate copies (only relevant when private sharing is on).
3. Photo retention period -- per-event override for how long photos are kept before automatic cleanup.

## Changes to `events` table
- `private_sharing_mode` (boolean, default false): When true, sharing links point to individual photos in Supabase Storage instead of SmugMug gallery.
- `skip_clean_version` (boolean, default false): When true, only the overlaid photo is saved to storage (not the clean AI-generated version).
- `photo_retention_days` (integer, default 30): Number of days before photos are auto-deleted from storage. NULL means never delete.

## Changes to `event_photos` table
- `overlay_storage_path` (text, nullable): Storage path of the overlaid version when saved to Supabase Storage.
- `overlay_public_url` (text, nullable): Public URL of the overlaid version in Supabase Storage.
- `retention_expires_at` (timestamptz, nullable): When this photo should be cleaned up. Calculated from the event's photo_retention_days at upload time. NULL means never expire.

## Security
- No new tables created.
- No RLS policy changes -- existing event and event_photos policies already govern access.
- New columns are nullable or have safe defaults so existing rows are unaffected.
*/

-- Add new columns to events table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'private_sharing_mode'
  ) THEN
    ALTER TABLE events ADD COLUMN private_sharing_mode boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'skip_clean_version'
  ) THEN
    ALTER TABLE events ADD COLUMN skip_clean_version boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'photo_retention_days'
  ) THEN
    ALTER TABLE events ADD COLUMN photo_retention_days integer DEFAULT 30;
  END IF;
END $$;

-- Add new columns to event_photos table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_photos' AND column_name = 'overlay_storage_path'
  ) THEN
    ALTER TABLE event_photos ADD COLUMN overlay_storage_path text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_photos' AND column_name = 'overlay_public_url'
  ) THEN
    ALTER TABLE event_photos ADD COLUMN overlay_public_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_photos' AND column_name = 'retention_expires_at'
  ) THEN
    ALTER TABLE event_photos ADD COLUMN retention_expires_at timestamptz;
  END IF;
END $$;
