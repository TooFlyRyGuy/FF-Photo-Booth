/*
  # Prevent Deletion of Prompts Currently in Use

  1. Changes
    - Change event_prompts foreign key from CASCADE to RESTRICT
    - This prevents deletion of prompts that are being used in events
    - User must remove prompt from events before deleting it

  2. Revert Previous Changes
    - Remove the permissive UPDATE policies on generated_images
    - Restore original event_prompts DELETE policy

  3. Security
    - Prompts can only be deleted if not in use by any event
    - Users can only delete their own prompts (or admins can delete all)
*/

-- Change event_prompts foreign key from CASCADE to RESTRICT
ALTER TABLE event_prompts
  DROP CONSTRAINT IF EXISTS event_prompts_prompt_id_fkey;

ALTER TABLE event_prompts
  ADD CONSTRAINT event_prompts_prompt_id_fkey
  FOREIGN KEY (prompt_id)
  REFERENCES prompts(id)
  ON DELETE RESTRICT;

-- Restore original event_prompts DELETE policy
DROP POLICY IF EXISTS "Users can delete event prompts for own events or prompts" ON event_prompts;

CREATE POLICY "Users can delete event prompts for own events"
  ON event_prompts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = event_prompts.event_id
      AND events.user_id = auth.uid()
    )
  );

-- Remove the permissive UPDATE policies from generated_images
DROP POLICY IF EXISTS "Allow system to nullify prompt_id on prompt deletion" ON generated_images;
DROP POLICY IF EXISTS "Allow system to nullify prompt_id on prompt deletion for anon" ON generated_images;
