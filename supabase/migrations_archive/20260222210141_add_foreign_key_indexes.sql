/*
  # Add Indexes for Foreign Keys

  ## Overview
  This migration adds indexes for all foreign keys that currently lack covering indexes.
  Foreign keys without indexes can cause significant performance degradation, especially
  for JOIN operations and cascading deletes/updates.

  ## Indexes Created
  
  ### Credit and Transaction Tables
  1. **credit_ledger**
     - idx_credit_ledger_user_id_fkey on user_id
  
  2. **credit_transactions**
     - idx_credit_transactions_user_id_fkey on user_id
  
  3. **user_credits**
     - idx_user_credits_purchased_event_pass_id_fkey on purchased_event_pass_id
     - idx_user_credits_subscription_tier_id_fkey on subscription_tier_id
  
  ### Event and Access Tables
  4. **event_access**
     - idx_event_access_granted_by_fkey on granted_by
     - idx_event_access_user_id_fkey on user_id
  
  5. **usage_logs**
     - idx_usage_logs_event_id_fkey on event_id
     - idx_usage_logs_user_id_fkey on user_id
  
  ### Event Pass Tables
  6. **event_pass_addons**
     - idx_event_pass_addons_addon_id_fkey on addon_id
     - idx_event_pass_addons_purchased_event_pass_id_fkey on purchased_event_pass_id
  
  7. **purchased_event_passes**
     - idx_purchased_event_passes_event_id_fkey on event_id
     - idx_purchased_event_passes_event_pass_tier_id_fkey on event_pass_tier_id
     - idx_purchased_event_passes_user_id_fkey on user_id
  
  8. **user_event_passes**
     - idx_user_event_passes_event_id_fkey on event_id
     - idx_user_event_passes_event_pass_id_fkey on event_pass_id
     - idx_user_event_passes_user_id_fkey on user_id
  
  ### Image and Upload Tables
  9. **generated_images**
     - idx_generated_images_prompt_id_fkey on prompt_id
  
  10. **smugmug_upload_queue**
     - idx_smugmug_upload_queue_event_id_fkey on event_id
     - idx_smugmug_upload_queue_generated_image_id_fkey on generated_image_id
  
  ### Prompt Tables
  11. **prompts**
     - idx_prompts_source_prompt_id_fkey on source_prompt_id
     - idx_prompts_user_id_fkey on user_id
  
  ### SMS and Communication Tables
  12. **sms_logs**
     - idx_sms_logs_image_id_fkey on image_id
     - idx_sms_logs_user_id_fkey on user_id
  
  ### Add-on and Purchase Tables
  13. **user_add_on_purchases**
     - idx_user_add_on_purchases_add_on_id_fkey on add_on_id
     - idx_user_add_on_purchases_user_id_fkey on user_id
  
  ### Webhook Tables
  14. **webhook_events**
     - idx_webhook_events_user_id_fkey on user_id
  
  ## Performance Impact
  These indexes will significantly improve:
  - JOIN operations involving these foreign keys
  - Queries filtering by these foreign key columns
  - Cascading delete and update operations
  - Overall query response times for related table operations
*/

-- Credit and Transaction Tables
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id_fkey ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id_fkey ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_purchased_event_pass_id_fkey ON user_credits(purchased_event_pass_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_subscription_tier_id_fkey ON user_credits(subscription_tier_id);

-- Event and Access Tables
CREATE INDEX IF NOT EXISTS idx_event_access_granted_by_fkey ON event_access(granted_by);
CREATE INDEX IF NOT EXISTS idx_event_access_user_id_fkey ON event_access(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_event_id_fkey ON usage_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id_fkey ON usage_logs(user_id);

-- Event Pass Tables
CREATE INDEX IF NOT EXISTS idx_event_pass_addons_addon_id_fkey ON event_pass_addons(addon_id);
CREATE INDEX IF NOT EXISTS idx_event_pass_addons_purchased_event_pass_id_fkey ON event_pass_addons(purchased_event_pass_id);
CREATE INDEX IF NOT EXISTS idx_purchased_event_passes_event_id_fkey ON purchased_event_passes(event_id);
CREATE INDEX IF NOT EXISTS idx_purchased_event_passes_event_pass_tier_id_fkey ON purchased_event_passes(event_pass_tier_id);
CREATE INDEX IF NOT EXISTS idx_purchased_event_passes_user_id_fkey ON purchased_event_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_event_passes_event_id_fkey ON user_event_passes(event_id);
CREATE INDEX IF NOT EXISTS idx_user_event_passes_event_pass_id_fkey ON user_event_passes(event_pass_id);
CREATE INDEX IF NOT EXISTS idx_user_event_passes_user_id_fkey ON user_event_passes(user_id);

-- Image and Upload Tables
CREATE INDEX IF NOT EXISTS idx_generated_images_prompt_id_fkey ON generated_images(prompt_id);
CREATE INDEX IF NOT EXISTS idx_smugmug_upload_queue_event_id_fkey ON smugmug_upload_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_smugmug_upload_queue_generated_image_id_fkey ON smugmug_upload_queue(generated_image_id);

-- Prompt Tables
CREATE INDEX IF NOT EXISTS idx_prompts_source_prompt_id_fkey ON prompts(source_prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompts_user_id_fkey ON prompts(user_id);

-- SMS and Communication Tables
CREATE INDEX IF NOT EXISTS idx_sms_logs_image_id_fkey ON sms_logs(image_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_user_id_fkey ON sms_logs(user_id);

-- Add-on and Purchase Tables
CREATE INDEX IF NOT EXISTS idx_user_add_on_purchases_add_on_id_fkey ON user_add_on_purchases(add_on_id);
CREATE INDEX IF NOT EXISTS idx_user_add_on_purchases_user_id_fkey ON user_add_on_purchases(user_id);

-- Webhook Tables
CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id_fkey ON webhook_events(user_id);
