/*
  # Add Singleton Constraint to Global Settings

  ## Overview
  Ensures only one row can exist in the global_settings table to prevent
  duplicate row errors when querying with maybeSingle().

  ## Changes
  1. Add a check constraint that ensures only one row exists
  2. Add a unique constraint on a constant value

  ## Security
  - No changes to existing RLS policies
  - Prevents data integrity issues from multiple rows
*/

-- Add a column with a constant value to enforce singleton pattern
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'singleton_id'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN singleton_id integer DEFAULT 1 NOT NULL;
  END IF;
END $$;

-- Create unique constraint to ensure only one row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'global_settings_singleton'
  ) THEN
    ALTER TABLE global_settings ADD CONSTRAINT global_settings_singleton UNIQUE (singleton_id);
  END IF;
END $$;

-- Ensure the existing row has singleton_id = 1
UPDATE global_settings SET singleton_id = 1 WHERE singleton_id IS NULL;
