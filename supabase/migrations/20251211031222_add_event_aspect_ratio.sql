/*
  # Add Aspect Ratio to Events

  1. Changes
    - Add `aspect_ratio` column to events table to store photo orientation/dimensions
    - Supports: 'square' (1:1), '3:4', '4:3', '9:16', '16:9'
    - Default to 'square' for existing events

  2. Notes
    - This allows event organizers to control the photo dimensions in the kiosk
    - Each event can have a different aspect ratio based on their needs
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'aspect_ratio'
  ) THEN
    ALTER TABLE events ADD COLUMN aspect_ratio text DEFAULT 'square';
    ALTER TABLE events ADD CONSTRAINT events_aspect_ratio_check 
      CHECK (aspect_ratio IN ('square', '3:4', '4:3', '9:16', '16:9'));
  END IF;
END $$;