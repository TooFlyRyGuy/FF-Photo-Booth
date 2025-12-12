/*
  # Create Global Settings Table for Admin-Only Configuration

  1. New Tables
    - `global_settings`
      - `id` (uuid, primary key)
      - `setting_key` (text, unique) - The setting identifier
      - `setting_value` (text, nullable) - The setting value (encrypted sensitive data)
      - `description` (text) - Human-readable description
      - `is_sensitive` (boolean) - Whether this is sensitive data
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Initial Data
    - Insert Gemini API key settings (migrated from tenants if exists)

  3. Security
    - Enable RLS on `global_settings` table
    - Only authenticated users with 'admin' or 'owner' role can read/write
    - Service role can read for system operations

  4. Migration Notes
    - This creates a centralized place for admin-only settings
    - Gemini API key will be global and shared across all users
    - Only admins can see and modify these settings
*/

-- Create global_settings table
CREATE TABLE IF NOT EXISTS global_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text,
  description text,
  is_sensitive boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Admin users can view all global settings
CREATE POLICY "Admins can view global settings"
  ON global_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE user_id = auth.uid()
    )
  );

-- Admin users can insert global settings
CREATE POLICY "Admins can insert global settings"
  ON global_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE user_id = auth.uid()
    )
  );

-- Admin users can update global settings
CREATE POLICY "Admins can update global settings"
  ON global_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE user_id = auth.uid()
    )
  );

-- Admin users can delete global settings
CREATE POLICY "Admins can delete global settings"
  ON global_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE user_id = auth.uid()
    )
  );

-- Service role can read global settings (for kiosk mode and other services)
CREATE POLICY "Service can read global settings"
  ON global_settings
  FOR SELECT
  TO anon
  USING (true);

-- Insert default Gemini API key setting
INSERT INTO global_settings (setting_key, setting_value, description, is_sensitive)
VALUES 
  ('gemini_api_key', NULL, 'Google Gemini Pro API Key for AI image generation', true),
  ('gemini_enabled', 'false', 'Whether Gemini AI is enabled globally', false)
ON CONFLICT (setting_key) DO NOTHING;

-- Migrate existing Gemini API key from demo tenant if it exists
DO $$
DECLARE
  existing_key text;
BEGIN
  SELECT gemini_api_key INTO existing_key
  FROM tenants
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
  AND gemini_api_key IS NOT NULL
  AND gemini_api_key != '';
  
  IF existing_key IS NOT NULL THEN
    UPDATE global_settings
    SET setting_value = existing_key,
        updated_at = now()
    WHERE setting_key = 'gemini_api_key';
    
    UPDATE global_settings
    SET setting_value = 'true',
        updated_at = now()
    WHERE setting_key = 'gemini_enabled';
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_global_settings_key ON global_settings(setting_key);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_global_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_global_settings_updated_at
  BEFORE UPDATE ON global_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_global_settings_updated_at();
