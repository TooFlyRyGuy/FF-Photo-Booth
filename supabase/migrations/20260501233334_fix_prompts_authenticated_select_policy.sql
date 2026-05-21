/*
  # Fix prompts authenticated SELECT policy

  ## Rule
  An authenticated user can SELECT a prompt if ANY of:
  1. They are the owner (user_id = auth.uid())
  2. The prompt is public (is_public = true)
  3. They are an admin (is_current_user_admin())

  Private prompts owned by someone else are NOT visible.
  This replaces the previous inline subquery with the consistent is_current_user_admin() helper.
*/

DROP POLICY IF EXISTS "Users can view their own prompts and public prompts" ON prompts;

CREATE POLICY "Users can view their own prompts and public prompts"
  ON prompts
  FOR SELECT
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()))
    OR (is_public = true)
    OR is_current_user_admin()
  );
