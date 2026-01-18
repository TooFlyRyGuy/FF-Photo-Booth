/*
  # Fix Generated Images Prompt Deletion Constraint

  1. Problem
    - generated_images.prompt_id has ON DELETE SET NULL but is NOT NULL
    - This causes deletion failures

  2. Solution
    - Change foreign key constraint to RESTRICT
    - Prompts cannot be deleted if they have generated images
    - User must manually handle generated images before deletion

  3. Security
    - Maintains data integrity
    - Prevents orphaned generated_images records
*/

-- Change generated_images foreign key from SET NULL to RESTRICT
ALTER TABLE generated_images
  DROP CONSTRAINT IF EXISTS generated_images_prompt_id_fkey;

ALTER TABLE generated_images
  ADD CONSTRAINT generated_images_prompt_id_fkey
  FOREIGN KEY (prompt_id)
  REFERENCES prompts(id)
  ON DELETE RESTRICT;
