/*
  # Add Public Access for Event Prompts and Prompts

  1. Purpose
    - Allow anonymous users to view prompts associated with active events
    - Enable kiosk mode to load event prompts without authentication

  2. Changes
    - Add SELECT policy for anon role on event_prompts table
    - Add SELECT policy for anon role on prompts table
    - Policies restricted to active events and active prompts only

  3. Security
    - Read-only access (SELECT only)
    - Only prompts for active events are accessible
    - Only active prompts (is_active = true) are accessible
*/

-- Add public access to event_prompts for active events
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view event prompts for active events" ON event_prompts;
  
  CREATE POLICY "Public can view event prompts for active events"
    ON event_prompts
    FOR SELECT
    TO anon
    USING (
      EXISTS (
        SELECT 1 FROM events
        WHERE events.id = event_prompts.event_id
        AND events.is_active = true
      )
    );
END $$;

-- Add public access to prompts (active prompts only)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view active prompts" ON prompts;
  
  CREATE POLICY "Public can view active prompts"
    ON prompts
    FOR SELECT
    TO anon
    USING (is_active = true);
END $$;
