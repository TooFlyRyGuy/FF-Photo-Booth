/*
  # Allow Kiosk Access to All Event Prompts
  
  ## Overview
  This migration allows anonymous kiosk users to view ALL prompts that are associated
  with an active event, regardless of whether the prompt is marked as public or private.
  If the event creator has access to a prompt and has attached it to an event, kiosk 
  users should be able to select it.
  
  ## Changes
  
  ### 1. Update Prompts RLS Policy for Anonymous Users
  - Replace the restrictive "Anonymous can view public prompts" policy
  - New policy allows viewing prompts that are either:
    a) Public AND active, OR
    b) Attached to an active event (via event_prompts table)
  
  ## Security Notes
  - Only prompts attached to active events are accessible
  - Event must be marked as is_active = true
  - This maintains security while enabling full kiosk functionality
  - Private prompts are still protected unless explicitly attached to an active event
*/

-- ============================================================================
-- Drop existing restrictive policy for anonymous users
-- ============================================================================

DROP POLICY IF EXISTS "Anonymous can view public prompts" ON prompts;

-- ============================================================================
-- Create new policy allowing kiosk access to event prompts
-- ============================================================================

CREATE POLICY "Anonymous can view public prompts or prompts in active events"
  ON prompts
  FOR SELECT
  TO anon
  USING (
    (is_active = true) 
    AND 
    (
      -- Allow viewing public prompts
      (is_public = true)
      OR
      -- Allow viewing any prompt attached to an active event
      EXISTS (
        SELECT 1
        FROM event_prompts ep
        JOIN events e ON e.id = ep.event_id
        WHERE ep.prompt_id = prompts.id
        AND e.is_active = true
      )
    )
  );
