/*
  # Fix authenticated users accessing prompts on another user's active event kiosk

  ## Problem
  The current prompts SELECT policy for authenticated users only allows access to:
  - Prompts they own (user_id = auth.uid())
  - Public prompts (is_public = true)
  - All prompts if admin

  This blocks an authenticated user from seeing private prompts that belong to another
  user's event, even when those prompts are actively in use on a live kiosk. Anonymous
  users can load event_prompts links (any active event), but then cannot resolve the
  prompt details either — the kiosk depends on being able to fetch prompt content.

  ## Changes
  - prompts: add a branch to the authenticated SELECT policy so prompts linked to an
    active event via event_prompts are readable by anyone (mirroring the anon design)
  - prompts: add a matching anon SELECT policy branch for prompts linked to active events
    (anon currently can only see is_public=true prompts, but the kiosk needs all
    event-linked prompts regardless of is_public flag)
*/

-- 1. Fix authenticated users: allow reading prompts tied to any active event
DROP POLICY IF EXISTS "Users can view their own prompts and public prompts" ON prompts;

CREATE POLICY "Users can view own, public, event-linked, or all if admin"
  ON prompts
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR is_public = true
    OR EXISTS (
      SELECT 1 FROM event_prompts ep
      JOIN events e ON e.id = ep.event_id
      WHERE ep.prompt_id = prompts.id
        AND e.is_active = true
    )
    OR is_current_user_admin()
  );

-- 2. Fix anonymous users: allow reading prompts tied to any active event
--    (anon policy previously only covered is_public=true prompts)
DROP POLICY IF EXISTS "Anon can view public active prompts" ON prompts;

CREATE POLICY "Anon can view public or event-linked active prompts"
  ON prompts
  FOR SELECT
  TO anon
  USING (
    (is_public = true AND is_active = true)
    OR EXISTS (
      SELECT 1 FROM event_prompts ep
      JOIN events e ON e.id = ep.event_id
      WHERE ep.prompt_id = prompts.id
        AND e.is_active = true
    )
  );
