/*
  # Fix Public Access to Prompts and Event Prompts

  1. Changes
    - Add public read access to prompts table
    - Add public read access to event_prompts table
    - This allows kiosk mode to load events with their associated prompts
  
  2. Security
    - Public can only SELECT (read) prompts and event_prompts
    - All other operations (INSERT, UPDATE, DELETE) still require authentication
*/

-- Allow public to view prompts
CREATE POLICY "Public can view prompts"
  ON prompts FOR SELECT
  TO public
  USING (true);

-- Allow public to view event_prompts (junction table)
CREATE POLICY "Public can view event prompts"
  ON event_prompts FOR SELECT
  TO public
  USING (true);
