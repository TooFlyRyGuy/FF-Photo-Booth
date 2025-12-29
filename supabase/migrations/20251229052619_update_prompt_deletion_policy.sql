/*
  # Update Prompt Deletion Policy
  
  1. Changes
    - Modify foreign key constraint on generated_images table
      - Change from ON DELETE RESTRICT to ON DELETE CASCADE
      - This allows prompts to be deleted even if they have generated images
      - Generated images will be automatically deleted when their prompt is deleted
    
    - Keep event_prompts foreign key constraint as ON DELETE RESTRICT
      - Prompts cannot be deleted if they are assigned to any events
      - This protects events from losing their prompt configurations
  
  2. Security
    - No RLS changes needed
    - Maintains data integrity by preventing deletion of prompts in active use
    - Allows cleanup of prompts that only have historical generated images
*/

-- Drop the existing foreign key constraint on generated_images
ALTER TABLE generated_images
DROP CONSTRAINT IF EXISTS generated_images_prompt_id_fkey;

-- Re-create the constraint with CASCADE delete behavior
ALTER TABLE generated_images
ADD CONSTRAINT generated_images_prompt_id_fkey
FOREIGN KEY (prompt_id)
REFERENCES prompts(id)
ON DELETE CASCADE;

-- Verify event_prompts constraint is still RESTRICT (it should be)
-- This ensures prompts cannot be deleted if they're assigned to events
DO $$
BEGIN
  -- Check if the constraint exists with RESTRICT
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'event_prompts_prompt_id_fkey'
    AND contype = 'f'
    AND confdeltype = 'r'
  ) THEN
    -- Drop and recreate if it's not RESTRICT
    ALTER TABLE event_prompts DROP CONSTRAINT IF EXISTS event_prompts_prompt_id_fkey;
    ALTER TABLE event_prompts
    ADD CONSTRAINT event_prompts_prompt_id_fkey
    FOREIGN KEY (prompt_id)
    REFERENCES prompts(id)
    ON DELETE RESTRICT;
  END IF;
END $$;