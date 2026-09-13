/*
# Fix prompt_translations RLS policies for public library prompts

1. Purpose
   The original INSERT/UPDATE/DELETE policies on prompt_translations only
   allowed writes when prompts.user_id = auth.uid(). Public library prompts
   have user_id = NULL, so translations could never be saved for them.
   This migration updates those policies to also allow writes when the
   prompt is a public library prompt (user_id IS NULL AND is_public = true).

2. Modified Policies
   - insert_prompt_translations: now allows writes for public library prompts
   - update_prompt_translations: now allows updates for public library prompts
   - delete_prompt_translations: now allows deletes for public library prompts

3. Security
   - SELECT policy is unchanged (already allows both owner and public prompts).
   - Write policies now check: prompts.user_id = auth.uid() OR
     (prompts.user_id IS NULL AND prompts.is_public = true).
   - Any authenticated user can add/edit translations for shared library
     prompts, which is the intended behavior since translations for public
     prompts are a shared community resource.
*/

-- Fix INSERT policy: allow writes for public library prompts too
DROP POLICY IF EXISTS "insert_prompt_translations" ON prompt_translations;
CREATE POLICY "insert_prompt_translations"
ON prompt_translations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND (
      prompts.user_id = auth.uid()
      OR (prompts.user_id IS NULL AND prompts.is_public = true)
    )
  )
);

-- Fix UPDATE policy: allow updates for public library prompts too
DROP POLICY IF EXISTS "update_prompt_translations" ON prompt_translations;
CREATE POLICY "update_prompt_translations"
ON prompt_translations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND (
      prompts.user_id = auth.uid()
      OR (prompts.user_id IS NULL AND prompts.is_public = true)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND (
      prompts.user_id = auth.uid()
      OR (prompts.user_id IS NULL AND prompts.is_public = true)
    )
  )
);

-- Fix DELETE policy: allow deletes for public library prompts too
DROP POLICY IF EXISTS "delete_prompt_translations" ON prompt_translations;
CREATE POLICY "delete_prompt_translations"
ON prompt_translations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND (
      prompts.user_id = auth.uid()
      OR (prompts.user_id IS NULL AND prompts.is_public = true)
    )
  )
);