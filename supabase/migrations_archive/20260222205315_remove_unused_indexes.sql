/*
  # Remove Unused Database Indexes

  ## Overview
  This migration removes indexes that are not being used by the database query planner.
  Unused indexes consume storage space and slow down INSERT, UPDATE, and DELETE operations
  without providing any query performance benefits.

  ## Indexes Removed
  
  ### User Credits Table
  - idx_user_credits_sms_credits
  - idx_user_credits_user_id (keeping primary key constraint)
  - idx_user_credits_subscription_sms_credits
  - idx_user_credits_purchased_sms_credits
  - idx_user_credits_event_sms_credits
  - idx_user_credits_subscription_tier_id
  - idx_user_credits_purchased_event_pass_id
  - idx_user_credits_expires_at
  
  ### Subscription Tables
  - idx_subscription_tiers_new_active_display
  - idx_subscription_tiers_category
  - idx_subscription_tiers_concurrent
  - idx_user_subscriptions_user_status
  - idx_user_subscriptions_cancel_status
  - idx_user_subscriptions_user_id
  - idx_user_subscriptions_status
  - idx_user_subscriptions_stripe_id
  
  ### Event Pass Tables
  - idx_event_passes_active_display
  - idx_event_passes_deterministic
  - idx_event_passes_priority
  - idx_purchased_event_passes_user_id
  - idx_purchased_event_passes_event_id
  - idx_purchased_event_passes_expires_at
  - idx_purchased_event_passes_event_pass_tier_id
  - idx_event_pass_addons_purchased_event_pass_id
  - idx_event_pass_addons_addon_id
  - idx_user_event_passes_activated_at
  - idx_user_event_passes_event_id
  - idx_user_event_passes_event_pass_id
  - idx_user_event_passes_user_id
  
  ### Credit & Transaction Tables
  - idx_credit_topup_products_active_display
  - idx_credit_transactions_user_id
  - idx_credit_ledger_user_id
  - idx_credit_ledger_created_at
  - idx_credit_ledger_source
  - idx_credit_ledger_stripe_session
  
  ### Other Tables
  - idx_smugmug_upload_queue_generated_image_id_fkey
  - idx_smugmug_upload_queue_event
  - idx_usage_logs_event_id
  - idx_usage_logs_user_id
  - idx_webhook_events_status
  - idx_webhook_events_created_at
  - idx_webhook_events_customer_id
  - idx_webhook_events_user_id
  - idx_prompts_source_prompt_id
  - idx_prompts_is_active
  - idx_prompts_is_active_created_at
  - idx_prompts_user_id
  - idx_generated_images_prompt_id
  - idx_sms_logs_image_id
  - idx_sms_logs_user_id
  - idx_event_access_user_id
  - idx_event_access_event_id
  - idx_event_access_granted_by
  - idx_user_profiles_subscription_status
  - idx_user_add_on_purchases_add_on_id
  - idx_user_add_on_purchases_user_id
  
  ## Performance Impact
  Removing unused indexes will:
  - Free up storage space
  - Speed up INSERT, UPDATE, and DELETE operations
  - Reduce index maintenance overhead
  - Have no negative impact on query performance since these indexes are not being used
*/

-- User Credits Table
DROP INDEX IF EXISTS idx_user_credits_sms_credits;
DROP INDEX IF EXISTS idx_user_credits_subscription_sms_credits;
DROP INDEX IF EXISTS idx_user_credits_purchased_sms_credits;
DROP INDEX IF EXISTS idx_user_credits_event_sms_credits;
DROP INDEX IF EXISTS idx_user_credits_subscription_tier_id;
DROP INDEX IF EXISTS idx_user_credits_purchased_event_pass_id;
DROP INDEX IF EXISTS idx_user_credits_expires_at;

-- Subscription Tables
DROP INDEX IF EXISTS idx_subscription_tiers_new_active_display;
DROP INDEX IF EXISTS idx_subscription_tiers_category;
DROP INDEX IF EXISTS idx_subscription_tiers_concurrent;
DROP INDEX IF EXISTS idx_user_subscriptions_user_status;
DROP INDEX IF EXISTS idx_user_subscriptions_cancel_status;
DROP INDEX IF EXISTS idx_user_subscriptions_user_id;
DROP INDEX IF EXISTS idx_user_subscriptions_status;
DROP INDEX IF EXISTS idx_user_subscriptions_stripe_id;

-- Event Pass Tables
DROP INDEX IF EXISTS idx_event_passes_active_display;
DROP INDEX IF EXISTS idx_event_passes_deterministic;
DROP INDEX IF EXISTS idx_event_passes_priority;
DROP INDEX IF EXISTS idx_purchased_event_passes_user_id;
DROP INDEX IF EXISTS idx_purchased_event_passes_event_id;
DROP INDEX IF EXISTS idx_purchased_event_passes_expires_at;
DROP INDEX IF EXISTS idx_purchased_event_passes_event_pass_tier_id;
DROP INDEX IF EXISTS idx_event_pass_addons_purchased_event_pass_id;
DROP INDEX IF EXISTS idx_event_pass_addons_addon_id;
DROP INDEX IF EXISTS idx_user_event_passes_activated_at;
DROP INDEX IF EXISTS idx_user_event_passes_event_id;
DROP INDEX IF EXISTS idx_user_event_passes_event_pass_id;
DROP INDEX IF EXISTS idx_user_event_passes_user_id;

-- Credit & Transaction Tables
DROP INDEX IF EXISTS idx_credit_topup_products_active_display;
DROP INDEX IF EXISTS idx_credit_transactions_user_id;
DROP INDEX IF EXISTS idx_credit_ledger_user_id;
DROP INDEX IF EXISTS idx_credit_ledger_created_at;
DROP INDEX IF EXISTS idx_credit_ledger_source;
DROP INDEX IF EXISTS idx_credit_ledger_stripe_session;

-- Other Tables
DROP INDEX IF EXISTS idx_smugmug_upload_queue_generated_image_id_fkey;
DROP INDEX IF EXISTS idx_smugmug_upload_queue_event;
DROP INDEX IF EXISTS idx_usage_logs_event_id;
DROP INDEX IF EXISTS idx_usage_logs_user_id;
DROP INDEX IF EXISTS idx_webhook_events_status;
DROP INDEX IF EXISTS idx_webhook_events_created_at;
DROP INDEX IF EXISTS idx_webhook_events_customer_id;
DROP INDEX IF EXISTS idx_webhook_events_user_id;
DROP INDEX IF EXISTS idx_prompts_source_prompt_id;
DROP INDEX IF EXISTS idx_prompts_is_active;
DROP INDEX IF EXISTS idx_prompts_is_active_created_at;
DROP INDEX IF EXISTS idx_prompts_user_id;
DROP INDEX IF EXISTS idx_generated_images_prompt_id;
DROP INDEX IF EXISTS idx_sms_logs_image_id;
DROP INDEX IF EXISTS idx_sms_logs_user_id;
DROP INDEX IF EXISTS idx_event_access_user_id;
DROP INDEX IF EXISTS idx_event_access_event_id;
DROP INDEX IF EXISTS idx_event_access_granted_by;
DROP INDEX IF EXISTS idx_user_profiles_subscription_status;
DROP INDEX IF EXISTS idx_user_add_on_purchases_add_on_id;
DROP INDEX IF EXISTS idx_user_add_on_purchases_user_id;
