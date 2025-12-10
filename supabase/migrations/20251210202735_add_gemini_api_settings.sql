/*
  # Add Google Gemini API Settings to Tenants

  1. Changes
    - Add Google Gemini API integration fields
      - `gemini_api_key` (API key for Gemini Pro)
      - `gemini_enabled` (boolean flag to enable/disable)
  
  2. Security
    - These fields contain sensitive API credentials
    - Should be handled with care and encrypted in production
*/

DO $$
BEGIN
  -- Add Gemini API key field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'gemini_api_key'
  ) THEN
    ALTER TABLE tenants ADD COLUMN gemini_api_key text;
  END IF;

  -- Add Gemini enabled flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'gemini_enabled'
  ) THEN
    ALTER TABLE tenants ADD COLUMN gemini_enabled boolean DEFAULT false;
  END IF;
END $$;
