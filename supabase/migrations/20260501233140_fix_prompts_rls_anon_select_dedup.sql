/*
  # Fix prompts RLS: remove duplicate anon SELECT policy

  ## Problem
  Two overlapping anon SELECT policies existed:
  - "Anon can view public active prompts" — subset of the other
  - "Anonymous can view public prompts or prompts in active events" — superset

  The duplicate causes multiple permissive policy overhead. Remove the redundant one.

  ## Result
  A single anon SELECT policy remains:
  - Active public prompts are visible to everyone (unauthenticated)
  - Active private prompts are visible to unauthenticated users ONLY if they are
    linked to an active event (kiosk use case)
*/

DROP POLICY IF EXISTS "Anon can view public active prompts" ON prompts;
