/*
  # Remove Unused Index on user_credits

  ## Overview
  This migration removes an unused index on the user_credits table to improve
  INSERT, UPDATE, and DELETE performance while freeing up storage space.

  ## Index Removed
  - idx_user_credits_user_id (unused, primary key constraint already exists)

  ## Performance Impact
  Removing this unused index will:
  - Free up storage space
  - Speed up INSERT, UPDATE, and DELETE operations
  - Reduce index maintenance overhead
  - Have no negative impact on query performance since the index is not being used
*/

DROP INDEX IF EXISTS idx_user_credits_user_id;
