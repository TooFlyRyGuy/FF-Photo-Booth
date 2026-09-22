/*
# Add composite index on prompts for paginated active prompt loading

## Purpose
The PromptLibrary component loads active prompts ordered by category then name.
Previously this required a sequential scan + sort. With 308+ prompts this is fast,
but as the library grows the sort cost increases. This partial index on
(is_active, category, name) gives the query planner a pre-sorted index for the
common filter+order path.

## Changes
- New index: idx_prompts_active_category_name on prompts(is_active, category, name)
  WHERE is_active = true (partial index, smaller and more targeted)

## Security
- No RLS or policy changes.
- No data changes.
*/

CREATE INDEX IF NOT EXISTS idx_prompts_active_category_name
ON public.prompts (category, name)
WHERE is_active = true;
