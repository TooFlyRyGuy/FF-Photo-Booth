/*
# Add mode, subcategory, and enabled_modes columns for sticker/photo/video modes

## Purpose
Supports a new kiosk experience where guests choose between Photo, Sticker, and Video
modes. Prompts are tagged with a mode, events specify which modes are available, and
sticker prompts generate transparent PNG images instead of JPEG.

## Changes

### 1. `prompts` table — new columns
- `mode` (text, NOT NULL, default 'photo') — 'photo' | 'sticker' | 'video'. Tags each
  prompt with the mode it belongs to. Existing prompts default to 'photo'.
- `subcategory` (text, nullable) — free-text subcategory within a mode (e.g., "Animals",
  "Quotes" within sticker mode). Used for filtering in the kiosk prompt selection screen.

### 2. `events` table — new column
- `enabled_modes` (text[], NOT NULL, default '{photo}') — which kiosk modes the event
  offers: 'photo', 'sticker', 'video'. Existing events default to photo-only, preserving
  current behavior.

### 3. `prompt_categories` table — new column
- `subcategories` (text[], nullable) — a list of subcategory names managed by admins
  for a given category. Used to populate the autocomplete suggestions in the prompt
  editor and the subcategory management UI.

## Security
- No new tables created; existing RLS policies on `prompts`, `events`, and
  `prompt_categories` continue to apply to the new columns automatically.
- The `service_role` grant on `prompt_categories` already covers full access.

## Important Notes
1. All existing prompts get `mode = 'photo'` — no behavior change for current events.
2. All existing events get `enabled_modes = '{photo}'` — the kiosk skips the mode
   selection screen when only one mode is enabled.
3. The `subcategories` array on `prompt_categories` is managed via the admin UI
   (add/rename/remove subcategory names per category).
4. Video mode is not yet functional — it will appear as "Coming Soon" in the UI.
*/

-- Add mode column to prompts (defaults to 'photo' for all existing rows)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prompts' AND column_name = 'mode') THEN
    ALTER TABLE prompts ADD COLUMN mode text NOT NULL DEFAULT 'photo';
  END IF;
END $$;

-- Add subcategory column to prompts (nullable free-text)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prompts' AND column_name = 'subcategory') THEN
    ALTER TABLE prompts ADD COLUMN subcategory text;
  END IF;
END $$;

-- Add enabled_modes column to events (defaults to '{photo}' for all existing events)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'enabled_modes') THEN
    ALTER TABLE events ADD COLUMN enabled_modes text[] NOT NULL DEFAULT '{photo}';
  END IF;
END $$;

-- Add subcategories array column to prompt_categories (nullable, managed by admins)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prompt_categories' AND column_name = 'subcategories') THEN
    ALTER TABLE prompt_categories ADD COLUMN subcategories text[];
  END IF;
END $$;

-- Add an index for filtering prompts by mode within an event context
CREATE INDEX IF NOT EXISTS idx_prompts_mode ON prompts(mode);
