/*
# Fix prompts UPDATE RLS policy for public prompts

## Problem
The existing UPDATE policy on `prompts` has a WITH CHECK clause:
  `(user_id = auth.uid() OR is_current_user_admin())`

Many prompts in the database have `user_id = NULL` (public/shared prompts).
In SQL, `NULL = auth.uid()` evaluates to NULL (not TRUE), so the WITH CHECK
fails for non-admin users editing public prompts. This causes the "error 200"
when saving prompt edits from this app.

The other app works because it either uses a SECURITY DEFINER function or
sets user_id before saving, bypassing this issue.

## Changes
1. Drop the existing UPDATE policy "Only owners can edit their prompts"
2. Recreate it with an updated WITH CHECK that also allows editing prompts
   where `user_id IS NULL` (public/shared prompts), matching the SELECT policy
   which already allows viewing public prompts.

## Security
- Authenticated users can update their own prompts (user_id = auth.uid())
- Authenticated users can update public prompts (user_id IS NULL)
- Admins can update any prompt
- Anon role is NOT allowed to update prompts
*/

DROP POLICY IF EXISTS "Only owners can edit their prompts" ON prompts;

CREATE POLICY "Only owners can edit their prompts" ON prompts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL OR is_current_user_admin())
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL OR is_current_user_admin());
