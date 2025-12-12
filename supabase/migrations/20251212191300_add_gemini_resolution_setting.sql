/*
  # Add Gemini Resolution Configuration

  This migration adds the ability to configure the resolution for Gemini AI image generation.

  ## Changes

  1. New Column
     - `tenants.gemini_resolution` - Stores the resolution setting for Gemini image generation
     - Options: '1K', '2K', '4K'
     - Default value: '1K'
     - Type: text, not null with default

  ## Notes

  - Allows per-tenant customization of image generation resolution
  - Default resolution is set to '1K' for optimal performance and cost
  - Higher resolutions (2K, 4K) provide better quality but may increase generation time and costs
*/

-- Add gemini_resolution column to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS gemini_resolution text DEFAULT '1K' NOT NULL;

-- Update existing tenants to use the default resolution
UPDATE tenants 
SET gemini_resolution = '1K' 
WHERE gemini_resolution IS NULL OR gemini_resolution = '';
