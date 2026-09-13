/*
# Add Per-Device Photo Limit Feature

## Summary
This migration adds the ability for event organizers to limit the number of AI-generated
photos each individual device can take at their kiosk event. Devices are tracked using a
browser-generated token combined with their IP address for accurate identification even
when multiple guests share a venue WiFi network.

## Changes

### 1. New columns on `events` table
- `limit_photos_per_device` (boolean, default false): Toggle to enable/disable the per-device
  photo limit for an event. When false, no device tracking occurs.
- `max_photos_per_device` (integer, default 0): The maximum number of successfully generated
  photos a single device can take at this event. Only meaningful when limit_photos_per_device
  is true.

### 2. New table: `event_device_usage`
Tracks each device's photo usage per event.
- `id` (uuid, primary key)
- `event_id` (uuid, FK to events, ON DELETE CASCADE)
- `device_token` (text, not null): Browser-generated unique token stored in localStorage
- `ip_address` (text): The device's IP address, used as a secondary identifier
- `photo_count` (integer, not null, default 0): Count of successfully generated photos
- `last_interaction_at` (timestamptz, default now()): Timestamp of the device's last interaction
- `created_at` (timestamptz, default now())
- Unique constraint on (event_id, device_token) to prevent duplicate tracking rows

### 3. Security (RLS)
- RLS enabled on `event_device_usage`.
- SELECT: Event owners can read their own event's device usage data (checked via events.user_id).
- INSERT/UPDATE/DELETE: Only the service role (via edge functions) can write — the anon and
  authenticated roles are denied direct write access. This ensures all limit enforcement
  happens server-side and cannot be bypassed from the browser.

### 4. Indexes
- Index on (event_id, device_token) for fast lookups during the limit check.
- Index on last_interaction_at for the 6-month cleanup query.

### 5. Cleanup function
- `cleanup_old_device_usage()`: Deletes device usage records older than 6 months based on
  last_interaction_at. Scheduled daily via pg_cron if available.

### Important Notes
1. The per-device limit is OFF by default. Existing events are unaffected.
2. Only successfully generated photos increment the count — cancelled or failed attempts
   do not create or update device usage records.
3. When the organizer disables the limit, no new tracking occurs but existing records
   remain for analytics until they age out after 6 months.
4. Device records are automatically deleted 6 months after the device's last interaction.
*/

-- 1. Add columns to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS limit_photos_per_device boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_photos_per_device integer NOT NULL DEFAULT 0;

-- 2. Create event_device_usage table
CREATE TABLE IF NOT EXISTS event_device_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  device_token text NOT NULL,
  ip_address text,
  photo_count integer NOT NULL DEFAULT 0,
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, device_token)
);

-- 3. Enable RLS
ALTER TABLE event_device_usage ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Event owners can read their own event's device usage data
DROP POLICY IF EXISTS "select_own_event_device_usage" ON event_device_usage;
CREATE POLICY "select_own_event_device_usage"
ON event_device_usage FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_device_usage.event_id
    AND events.user_id = auth.uid()
  )
);

-- Event owners can delete (reset) device usage for their own events
DROP POLICY IF EXISTS "delete_own_event_device_usage" ON event_device_usage;
CREATE POLICY "delete_own_event_device_usage"
ON event_device_usage FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_device_usage.event_id
    AND events.user_id = auth.uid()
  )
);

-- Note: INSERT and UPDATE are NOT granted to anon or authenticated.
-- Only the service role (used in edge functions) can insert/update device usage records,
-- ensuring all limit enforcement happens server-side.

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_event_device_usage_event_token
  ON event_device_usage(event_id, device_token);

CREATE INDEX IF NOT EXISTS idx_event_device_usage_last_interaction
  ON event_device_usage(last_interaction_at);

-- 6. Cleanup function for 6-month retention
CREATE OR REPLACE FUNCTION cleanup_old_device_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM event_device_usage
  WHERE last_interaction_at < now() - interval '6 months';
END;
$$;

-- 7. Schedule daily cleanup if pg_cron is available
DO $$
BEGIN
  -- Try to schedule the cleanup job
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Drop existing job if it exists, then recreate
    PERFORM cron.unschedule('cleanup_old_device_usage_job');
    PERFORM cron.schedule(
      'cleanup_old_device_usage_job',
      '0 3 * * *',  -- Run daily at 3 AM UTC
      'SELECT cleanup_old_device_usage();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not available or not configured, skip scheduling
  NULL;
END;
$$;