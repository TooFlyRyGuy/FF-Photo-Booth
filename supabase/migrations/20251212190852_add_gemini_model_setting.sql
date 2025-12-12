/*
  # Add Gemini Model Configuration

  This migration adds the ability to configure which Gemini AI model to use for image generation.

  ## Changes

  1. New Column
     - `tenants.gemini_model` - Stores the Gemini model identifier (e.g., 'gemini-3-pro-image-preview')
     - Default value: 'gemini-3-pro-image-preview'
     - Type: text, nullable (NULL means use default)

  ## Notes

  - Allows per-tenant customization of which Gemini model to use
  - Default model is set to 'gemini-3-pro-image-preview' as requested
  - Existing tenants will automatically use the default model
*/

-- Add gemini_model column to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS gemini_model text DEFAULT 'gemini-3-pro-image-preview';

-- Update existing tenants to use the default model
UPDATE tenants 
SET gemini_model = 'gemini-3-pro-image-preview' 
WHERE gemini_model IS NULL;
