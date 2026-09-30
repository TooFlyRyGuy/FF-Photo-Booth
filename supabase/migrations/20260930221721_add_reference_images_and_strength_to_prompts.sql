/*
# Add Multiple Reference Images and Strength to Prompts

## Purpose
Support multiple AI style reference images per prompt, each with its own
strength weighting (0-100). Previously only a single reference image was
supported with no strength control.

## Changes

### New Columns on `prompts` table
1. `reference_images` (jsonb, nullable) — Array of objects, each containing:
   - `url` (text): public URL to a .jpg image in the prompt-images storage bucket
   - `strength` (integer, 0-100): how strongly the AI should weight this reference
   Example: `[{"url":"https://...ref1.jpg","strength":60},{"url":"https://...ref2.jpg","strength":30}]`

2. `reference_strength` (integer, default 50) — Default strength applied to
   reference images that don't specify their own strength value.

### Backward Compatibility
- The existing `reference_image_url` text column is kept as-is.
- If `reference_images` is populated, it takes priority over `reference_image_url`.
- Existing prompts with only `reference_image_url` continue to work unchanged.

### Security
- No RLS policy changes needed — the new columns inherit the existing
  prompts table RLS policies (owner-scoped CRUD for authenticated users,
  anon read for active/public prompts).
*/

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS reference_images jsonb DEFAULT NULL;

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS reference_strength integer DEFAULT 50;

COMMENT ON COLUMN prompts.reference_images IS 'JSON array of {url, strength} objects for multiple AI style reference images. Takes priority over reference_image_url when populated.';
COMMENT ON COLUMN prompts.reference_strength IS 'Default strength (0-100) for reference images that do not specify their own strength value.';
