/*
  # Add Library Webhook URL and Anon Prompt Read Policy

  ## Changes

  1. **global_settings** — adds `library_webhook_url` column
     - Stores the URL to POST to when a client submits their prompt cart
     - Admin-only write, service role read

  2. **prompts RLS** — adds a SELECT policy for the `anon` role
     - Anon users can read prompts where `is_public = true` AND `is_active = true`
     - No write access of any kind for anon (existing policies only cover authenticated)
     - This powers the /library page for unauthenticated visitors
*/

-- Add webhook URL column to global_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'library_webhook_url'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN library_webhook_url text;
  END IF;
END $$;

-- Allow anon to read public active prompts (for the /library page)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'prompts' AND policyname = 'Anon can view public active prompts'
  ) THEN
    CREATE POLICY "Anon can view public active prompts"
      ON prompts
      FOR SELECT
      TO anon
      USING (is_public = true AND is_active = true);
  END IF;
END $$;
