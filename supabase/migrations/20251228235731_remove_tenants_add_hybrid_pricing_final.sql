/*
  # Remove Tenants and Add Hybrid Pricing Model

  1. Schema Changes
    - Add user_id to events table (references auth.users)
    - Add user_id to prompts table (references auth.users)
    - Add is_public column to prompts table for shared prompts
    - Remove tenant_id foreign key from prompts table
    - Keep created_by in events for backwards compatibility

  2. Data Migration
    - Copy created_by to user_id in events table
    - Set prompts without tenant as public (is_public = true)

  3. Security
    - RLS policies updated in subsequent migrations to use user_id
*/

-- Add user_id to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE events ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill user_id from created_by for existing events
UPDATE events SET user_id = created_by WHERE user_id IS NULL AND created_by IS NOT NULL;

-- Add user_id to prompts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prompts' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE prompts ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add is_public column to prompts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prompts' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE prompts ADD COLUMN is_public boolean DEFAULT false;
  END IF;
END $$;

-- Set existing prompts as public (they were shared via tenant_id)
UPDATE prompts SET is_public = true WHERE is_public IS NULL;

-- Drop tenant_id foreign key constraint from prompts if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%prompts_tenant_id_fkey%'
    AND table_name = 'prompts'
  ) THEN
    ALTER TABLE prompts DROP CONSTRAINT IF EXISTS prompts_tenant_id_fkey;
  END IF;
END $$;
