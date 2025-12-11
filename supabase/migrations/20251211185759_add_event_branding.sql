/*
  # Add Event Branding Customization

  ## Overview
  Adds branding and customization fields to events table to allow per-event kiosk theming.

  ## Changes
  
  1. New Columns Added to `events` table:
    - `background_image_url` (text, optional) - Custom background image for kiosk
    - `logo_url` (text, optional) - Logo to display during photo capture
    - `primary_color` (text, optional) - Primary brand color (hex code)
    - `secondary_color` (text, optional) - Secondary brand color (hex code)
    - `accent_color` (text, optional) - Accent/highlight color (hex code)
  
  ## Notes
  - All new fields are nullable to maintain backward compatibility
  - Default values can be applied at the application layer
  - Colors should be stored as hex codes (e.g., #FF5733)
*/

DO $$
BEGIN
  -- Add background_image_url if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'background_image_url'
  ) THEN
    ALTER TABLE events ADD COLUMN background_image_url text;
  END IF;

  -- Add logo_url if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE events ADD COLUMN logo_url text;
  END IF;

  -- Add primary_color if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'primary_color'
  ) THEN
    ALTER TABLE events ADD COLUMN primary_color text;
  END IF;

  -- Add secondary_color if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'secondary_color'
  ) THEN
    ALTER TABLE events ADD COLUMN secondary_color text;
  END IF;

  -- Add accent_color if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'accent_color'
  ) THEN
    ALTER TABLE events ADD COLUMN accent_color text;
  END IF;
END $$;
