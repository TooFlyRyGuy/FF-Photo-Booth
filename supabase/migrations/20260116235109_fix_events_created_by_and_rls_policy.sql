/*
  # Fix Events created_by Field and RLS Policy
  
  1. Backfill Data
    - Set created_by to user_id for all existing events where created_by is NULL
  
  2. Security Changes
    - Update events UPDATE policy to check both created_by OR user_id
    - This ensures events can be updated even if created_by was NULL in the past
    - Maintains backward compatibility while fixing SmugMug gallery save issue
  
  3. Important Notes
    - This fixes the issue where SmugMug galleries were created but not saved to database
    - The UPDATE was failing silently due to RLS checking only created_by (which was NULL)
    - Going forward, all new events will have created_by set during creation
*/

-- Backfill created_by field for existing events
UPDATE events
SET created_by = user_id
WHERE created_by IS NULL;

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update events" ON events;

-- Create new UPDATE policy that checks both created_by and user_id
CREATE POLICY "Users can update own events or admin can update all"
  ON events
  FOR UPDATE
  TO authenticated
  USING (
    (created_by = auth.uid()) 
    OR (user_id = auth.uid()) 
    OR is_current_user_admin()
  )
  WITH CHECK (
    (created_by = auth.uid()) 
    OR (user_id = auth.uid()) 
    OR is_current_user_admin()
  );