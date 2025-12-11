/*
  # Add Branding Visibility Options

  ## Overview
  Adds options to control visibility of logo and event name in the kiosk attract screen.

  ## Changes
  
  1. New Columns Added to `events` table:
    - `hide_logo` (boolean, default false) - Hide logo on attract screen
    - `hide_event_name` (boolean, default false) - Hide event name on attract screen
  
  ## Notes
  - Both fields default to false (show branding by default)
  - Allows per-event control of branding display
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'hide_logo'
  ) THEN
    ALTER TABLE events ADD COLUMN hide_logo boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'hide_event_name'
  ) THEN
    ALTER TABLE events ADD COLUMN hide_event_name boolean DEFAULT false;
  END IF;
END $$;
