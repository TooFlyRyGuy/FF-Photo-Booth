/*
  # Add SmugMug Username Cache

  1. Changes
    - Add `smugmug_username` column to `global_settings` table to cache the SmugMug username
    - This avoids repeated slow API calls to SmugMug's GraphQL API

  2. Purpose
    - Optimize SmugMug API performance by caching the username
    - Reduce timeout issues caused by slow GraphQL queries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'smugmug_username'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN smugmug_username text;
  END IF;
END $$;