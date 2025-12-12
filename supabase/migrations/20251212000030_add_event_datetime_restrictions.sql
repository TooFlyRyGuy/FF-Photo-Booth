/*
  # Add Event DateTime Restrictions

  1. Changes
    - Add `start_datetime` column to `events` table
      - Type: timestamptz (timestamp with timezone)
      - Nullable: true (existing events won't have this set)
    - Add `end_datetime` column to `events` table
      - Type: timestamptz (timestamp with timezone)
      - Nullable: true (existing events won't have this set)
  
  2. Purpose
    - Allows events to have specific start and end times
    - Enables time-based access control for kiosk mode
    - Shows "Event not started" message before start time
    - Shows "Event has ended" message after end time
  
  3. Notes
    - Both fields are optional to maintain backward compatibility
    - If not set, events remain accessible at all times
*/

-- Add start and end datetime columns to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'start_datetime'
  ) THEN
    ALTER TABLE events ADD COLUMN start_datetime timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'end_datetime'
  ) THEN
    ALTER TABLE events ADD COLUMN end_datetime timestamptz;
  END IF;
END $$;