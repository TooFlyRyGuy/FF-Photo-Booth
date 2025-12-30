/*
  # Allow Public Access to Prompts in Active Events

  ## Overview
  This migration adds an RLS policy to allow anyone (including anonymous users)
  to view prompts that are attached to active events. This ensures kiosk mode
  works properly for public users without requiring authentication.

  ## Changes

  ### 1. Add Public Prompts Access Policy
  - Allows anonymous users to view prompts attached to active events
  - This enables kiosk mode to display prompts without requiring login

  ## Security Notes
  - Only prompts attached to active events are accessible
  - Event must be marked as is_active = true
  - This maintains security while allowing public kiosk access
*/

-- ============================================================================
-- STEP 1: Add policy to allow public viewing of prompts in active events
-- ============================================================================

-- Drop existing policy if it exists and create new one
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view prompts for active events" ON prompts;
END $$;

CREATE POLICY "Public can view prompts for active events"
  ON prompts
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM event_prompts ep
      JOIN events e ON e.id = ep.event_id
      WHERE ep.prompt_id = prompts.id
      AND e.is_active = true
    )
  );
