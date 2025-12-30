/*
  # Fix Prompts RLS for Shared Events

  ## Overview
  This migration fixes the RLS policies to allow users to view prompts that are
  attached to events they have access to (either owned by them or shared via event_access).

  ## Changes

  ### 1. Add Prompts Access via Shared Events Policy
  - Users can view prompts attached to events they own or have been granted access to
  - This allows users with shared event access to see the prompts for those events

  ### 2. Clean Up Duplicate Event Policies
  - Remove duplicate SELECT policies on events table
  - Keep only the most comprehensive policy for viewing events

  ## Security Notes
  - Users can only view prompts for events they own or have been explicitly granted access to
  - Public users (anon) can still view active prompts via existing policy
  - Admins maintain full access via existing admin policies
*/

-- ============================================================================
-- STEP 1: Add policy to allow viewing prompts for shared events
-- ============================================================================

-- Drop existing policy if it exists and create new one
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view prompts for accessible events" ON prompts;
END $$;

CREATE POLICY "Users can view prompts for accessible events"
  ON prompts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM event_prompts ep
      JOIN events e ON e.id = ep.event_id
      WHERE ep.prompt_id = prompts.id
      AND (
        e.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 
          FROM event_access ea 
          WHERE ea.event_id = e.id 
          AND ea.user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- STEP 2: Clean up duplicate event SELECT policies
-- ============================================================================

-- Drop duplicate policies
DROP POLICY IF EXISTS "Authenticated users can view own events or all if admin" ON events;
DROP POLICY IF EXISTS "Users can view own events and shared events" ON events;
DROP POLICY IF EXISTS "Users can view own events or shared events" ON events;

-- Keep only the most comprehensive policy
-- This policy already exists and covers all cases:
-- "Users can view their own or shared events"
-- It allows viewing events where:
-- - user_id = auth.uid() (owned events)
-- - OR EXISTS check in event_access (shared events)
