/*
  # Add Overlay Image Support to Events

  1. Changes
    - Add `overlay_image_url` column to events table
      - Stores URL of transparent PNG overlay image
      - Optional field (can be null)
      - Overlay dimensions should match the event's aspect ratio
      - Overlay will be composited on top of generated AI images

  2. Purpose
    - Allows events to have custom branded overlays (frames, borders, logos, etc.)
    - Automatically applied to all generated images for the event
    - Supports transparent PNGs for professional branding
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'overlay_image_url'
  ) THEN
    ALTER TABLE events ADD COLUMN overlay_image_url text;
  END IF;
END $$;
