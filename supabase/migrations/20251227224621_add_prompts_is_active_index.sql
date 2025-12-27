/*
  # Add Index for Prompts is_active Column

  1. Changes
    - Add index on is_active column for prompts table
    - This column is frequently used in WHERE clauses when fetching prompts
    - Will significantly speed up queries that filter by is_active

  2. Performance Impact
    - Faster prompt list queries in admin dashboard
    - Faster prompt library loading
    - Reduced query time when filtering active prompts
*/

-- Add index on is_active if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_prompts_is_active ON prompts(is_active);

-- Add composite index for the most common query pattern (is_active + created_at for ordering)
CREATE INDEX IF NOT EXISTS idx_prompts_is_active_created_at ON prompts(is_active, created_at DESC);