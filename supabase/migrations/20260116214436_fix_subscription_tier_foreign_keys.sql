/*
  # Fix Subscription Tier Foreign Key Constraints
  
  1. Changes
    - Drop old foreign key constraint on user_credits pointing to old subscription_tiers table
    - Add new foreign key constraint pointing to subscription_tiers_new table
    - Add unique constraint on user_subscriptions.user_id for proper upsert operations
  
  2. Reasoning
    - The webhook was updated to use subscription_tiers_new table
    - user_credits needs to reference the same table
    - user_subscriptions needs unique constraint on user_id for conflict resolution
*/

-- Drop old foreign key constraint
ALTER TABLE user_credits 
DROP CONSTRAINT IF EXISTS user_credits_subscription_tier_id_fkey;

-- Add new foreign key constraint to subscription_tiers_new
ALTER TABLE user_credits 
ADD CONSTRAINT user_credits_subscription_tier_id_fkey 
FOREIGN KEY (subscription_tier_id) 
REFERENCES subscription_tiers_new(id);

-- Add unique constraint on user_subscriptions.user_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'user_subscriptions' 
    AND constraint_name = 'user_subscriptions_user_id_key'
  ) THEN
    ALTER TABLE user_subscriptions 
    ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END $$;