/*
  # Remove Tenant-Specific Dropbox Credentials
  
  1. Changes
    - Mark `dropbox_app_key` and `dropbox_app_secret` as optional (no longer required per tenant)
    - These credentials will now be stored in environment variables for the entire platform
    
  2. Purpose
    - Simplify Dropbox integration by using a single Dropbox app for all tenants
    - Each tenant will connect their personal Dropbox account via OAuth
    - Eliminates the need for each tenant to create their own Dropbox app
    
  3. Migration Strategy
    - Keep the columns for backward compatibility but they won't be used
    - Existing data remains intact but new tenants won't need to provide these values
*/

-- The columns already exist and are nullable, so no structural changes needed
-- This migration serves as documentation of the architectural change

-- Optional: Clear out any existing app keys/secrets since they're no longer used
-- Uncomment if you want to clean up old data:
-- UPDATE tenants SET dropbox_app_key = NULL, dropbox_app_secret = NULL;