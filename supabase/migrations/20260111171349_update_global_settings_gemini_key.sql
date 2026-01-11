/*
  # Update Global Settings with Gemini API Key

  1. Overview
    This migration updates the existing global_settings row to ensure Gemini API key 
    is properly configured for all users to access.

  2. Changes
    - Updates gemini_api_key in the existing global_settings row
    - Sets gemini_enabled to true
    - Configures default model and resolution

  3. Security
    - RLS policies already allow all users (authenticated and anonymous) to read
    - Only admins can modify global settings
*/

-- Update the existing global_settings row with Gemini API key
UPDATE global_settings
SET
  gemini_api_key = 'AIzaSyAf8dUd9wv0R_Axr2sxsdtBhsP3oBJBNP8',
  gemini_enabled = true,
  gemini_model = 'gemini-3-pro-image-preview',
  gemini_resolution = '1K',
  updated_at = now()
WHERE singleton_id = 1;