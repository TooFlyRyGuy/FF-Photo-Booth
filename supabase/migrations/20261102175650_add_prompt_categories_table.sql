/*
# Add prompt_categories table for category-level privacy

## Purpose
Allows marking an entire prompt category as private so it doesn't appear
in the public-facing library (https://aibooth.funframephoto.com/?library=1)
while still being available for use in events via the admin prompt library.

## New Table
- `prompt_categories`
  - `id` (uuid, primary key)
  - `category` (text, unique, not null) — matches the `category` text column on `prompts`
  - `is_private` (boolean, default false) — when true, the category is hidden from public view
  - `created_at` (timestamptz)

## Security
- RLS enabled on `prompt_categories`
- `anon` + `authenticated` can SELECT (needed so the public library can check privacy)
- Only `authenticated` users can INSERT/UPDATE/DELETE (admins manage category privacy)
- `service_role` gets full access for edge functions
*/

CREATE TABLE IF NOT EXISTS prompt_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text UNIQUE NOT NULL,
  is_private boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prompt_categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON prompt_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON prompt_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON prompt_categories TO service_role;

DROP POLICY IF EXISTS "anon_select_prompt_categories" ON prompt_categories;
CREATE POLICY "anon_select_prompt_categories"
ON prompt_categories FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_prompt_categories" ON prompt_categories;
CREATE POLICY "auth_insert_prompt_categories"
ON prompt_categories FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_prompt_categories" ON prompt_categories;
CREATE POLICY "auth_update_prompt_categories"
ON prompt_categories FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_prompt_categories" ON prompt_categories;
CREATE POLICY "auth_delete_prompt_categories"
ON prompt_categories FOR DELETE
TO authenticated USING (true);
