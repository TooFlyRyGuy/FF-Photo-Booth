/*
# Add Language Settings and Prompt Translations

1. Purpose
   Adds per-user account language and per-event kiosk language preferences,
   plus a prompt_translations table to store translated prompt names and
   descriptions in multiple languages.

2. New Columns
   - `user_settings.account_language` (text, default 'en-US') — controls the
     language of the organizer's own dashboard/admin interface.
   - `events.kiosk_language` (text, default 'en-US') — controls the language
     of the guest-facing kiosk screen for that event.

3. New Tables
   - `prompt_translations`
     - `id` (uuid, primary key)
     - `prompt_id` (uuid, foreign key to prompts.id, ON DELETE CASCADE)
     - `language_code` (text, not null — e.g. 'es', 'fr', 'de', 'pt', 'zh', 'ja')
     - `name` (text, not null — translated prompt name)
     - `description` (text — translated prompt description)
     - `updated_at` (timestamptz, default now())
     - Unique constraint on (prompt_id, language_code) so each prompt has
       at most one translation per language.

4. Security
   - Enable RLS on `prompt_translations`.
   - SELECT: authenticated users can read translations for prompts they own
     (prompt.user_id = auth.uid()) OR prompts that are public
     (user_id IS NULL). Anon can also read, so the kiosk (which uses the anon
     key) can load translations for active event prompts.
   - INSERT/UPDATE/DELETE: only the prompt owner (prompt.user_id = auth.uid())
     can write translations for their own prompts.

5. Supported Language Codes
   - en-US (base/default), es, fr, de, pt, zh, ja
*/

-- Add account_language to user_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'account_language'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN account_language text NOT NULL DEFAULT 'en-US';
  END IF;
END $$;

-- Add kiosk_language to events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'kiosk_language'
  ) THEN
    ALTER TABLE events ADD COLUMN kiosk_language text NOT NULL DEFAULT 'en-US';
  END IF;
END $$;

-- Create prompt_translations table
CREATE TABLE IF NOT EXISTS prompt_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  name text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (prompt_id, language_code)
);

-- Enable RLS
ALTER TABLE prompt_translations ENABLE ROW LEVEL SECURITY;

-- SELECT: prompt owners + public prompts + anon (for kiosk)
DROP POLICY IF EXISTS "select_prompt_translations" ON prompt_translations;
CREATE POLICY "select_prompt_translations"
ON prompt_translations FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND (prompts.user_id = auth.uid() OR prompts.user_id IS NULL)
  )
);

-- INSERT: only prompt owner
DROP POLICY IF EXISTS "insert_prompt_translations" ON prompt_translations;
CREATE POLICY "insert_prompt_translations"
ON prompt_translations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND prompts.user_id = auth.uid()
  )
);

-- UPDATE: only prompt owner
DROP POLICY IF EXISTS "update_prompt_translations" ON prompt_translations;
CREATE POLICY "update_prompt_translations"
ON prompt_translations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND prompts.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND prompts.user_id = auth.uid()
  )
);

-- DELETE: only prompt owner
DROP POLICY IF EXISTS "delete_prompt_translations" ON prompt_translations;
CREATE POLICY "delete_prompt_translations"
ON prompt_translations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND prompts.user_id = auth.uid()
  )
);

-- Index for faster lookups by prompt_id
CREATE INDEX IF NOT EXISTS idx_prompt_translations_prompt_id ON prompt_translations(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_translations_language_code ON prompt_translations(language_code);
