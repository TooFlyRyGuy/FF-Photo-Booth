/*
# Add custom_fields column to prompts table

1. Changes
- Adds `custom_fields` (jsonb, nullable, default null) to the `prompts` table.
- This column stores the array of PromptCustomField objects that define
  guest input fields (text, dropdown, checkbox, etc.) for each prompt.
- The frontend already reads and writes this column; it was referenced in
  code but never created in the database, causing all prompt list queries
  to fail silently.

2. Security
- No RLS policy changes needed. The existing policies on `prompts` already
  cover the new column since it is selected alongside other columns.
*/

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT null;
