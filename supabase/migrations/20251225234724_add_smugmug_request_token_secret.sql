/*
  # Add SmugMug Request Token Secret Column

  1. Schema Changes
    - Add `smugmug_request_token_secret` column to store temporary request token secret
    - This separates the OAuth flow's request token secret from the final access token secret
    - Prevents conflicts during the token exchange process

  2. Security
    - No policy changes needed (inherits from global_settings)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_settings' AND column_name = 'smugmug_request_token_secret'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN smugmug_request_token_secret text;
  END IF;
END $$;