/*
  # Add Integration Settings to Tenants

  1. Changes
    - Add Dropbox integration fields
      - `dropbox_access_token` (encrypted storage for OAuth token)
      - `dropbox_enabled` (boolean flag)
    - Add Twilio integration fields
      - `twilio_account_sid` (Twilio account identifier)
      - `twilio_auth_token` (Twilio authentication token)
      - `twilio_phone_number` (Twilio sender phone number)
      - `twilio_enabled` (boolean flag)
  
  2. Security
    - These fields contain sensitive data and should be accessed carefully
    - In production, consider using Supabase Vault for encrypted storage
*/

DO $$
BEGIN
  -- Add Dropbox fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'dropbox_access_token'
  ) THEN
    ALTER TABLE tenants ADD COLUMN dropbox_access_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'dropbox_enabled'
  ) THEN
    ALTER TABLE tenants ADD COLUMN dropbox_enabled boolean DEFAULT false;
  END IF;

  -- Add Twilio fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'twilio_account_sid'
  ) THEN
    ALTER TABLE tenants ADD COLUMN twilio_account_sid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'twilio_auth_token'
  ) THEN
    ALTER TABLE tenants ADD COLUMN twilio_auth_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'twilio_phone_number'
  ) THEN
    ALTER TABLE tenants ADD COLUMN twilio_phone_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'twilio_enabled'
  ) THEN
    ALTER TABLE tenants ADD COLUMN twilio_enabled boolean DEFAULT false;
  END IF;
END $$;
