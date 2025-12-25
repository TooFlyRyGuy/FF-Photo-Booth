/*
  # Add Prompt Tags and Library Enhancements

  ## Overview
  Enhances the prompts system with tagging capabilities and optimizes event-prompt loading.
  This migration enables a Prompt Library Module where prompts can be tagged, filtered, and
  selectively added to events.

  ## Changes Made

  ### 1. New Columns
  - `prompts.tags` (text[]) - Array of tags for categorizing and filtering prompts
    * Enables filtering by theme, style, season, etc.
    * Examples: ['holiday', 'professional', 'fun', 'vintage']
  
  ### 2. Indexes
  - GIN index on `prompts.tags` - Fast tag-based filtering using array contains operations
  - Index on `event_prompts.display_order` - Optimized ordering for kiosk display

  ## Usage Examples

  ### Tag-based filtering:
  ```sql
  SELECT * FROM prompts WHERE tags @> ARRAY['holiday', 'professional'];
  ```

  ### Get prompts for an event in display order:
  ```sql
  SELECT p.* FROM prompts p
  JOIN event_prompts ep ON ep.prompt_id = p.id
  WHERE ep.event_id = 'event-uuid'
  ORDER BY ep.display_order;
  ```

  ## Security
  - Existing RLS policies remain in effect
  - No new security concerns introduced
  - Tags are publicly readable (kiosk needs access)

  ## Performance
  - GIN index enables O(log n) tag lookups
  - Display order index prevents full table scans for kiosk loading
*/

-- Add tags column to prompts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prompts' AND column_name = 'tags'
  ) THEN
    ALTER TABLE prompts ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
END $$;

-- Add GIN index for efficient tag filtering
CREATE INDEX IF NOT EXISTS idx_prompts_tags ON prompts USING GIN (tags);

-- Add index on display_order for efficient event prompt loading
CREATE INDEX IF NOT EXISTS idx_event_prompts_display_order ON event_prompts(event_id, display_order);

-- Add helpful comment
COMMENT ON COLUMN prompts.tags IS 'Array of tags for categorizing and filtering prompts (e.g., holiday, professional, fun, vintage)';