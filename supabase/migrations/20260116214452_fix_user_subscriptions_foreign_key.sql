/*
  # Fix User Subscriptions Foreign Key Constraint
  
  1. Changes
    - Drop old foreign key constraint on user_subscriptions.tier_id pointing to old subscription_tiers table
    - Add new foreign key constraint pointing to subscription_tiers_new table
  
  2. Reasoning
    - The webhook and user_credits now use subscription_tiers_new
    - user_subscriptions also needs to reference the new table
*/

-- Drop old foreign key constraint
ALTER TABLE user_subscriptions 
DROP CONSTRAINT IF EXISTS user_subscriptions_tier_id_fkey;

-- Add new foreign key constraint to subscription_tiers_new
ALTER TABLE user_subscriptions 
ADD CONSTRAINT user_subscriptions_tier_id_fkey 
FOREIGN KEY (tier_id) 
REFERENCES subscription_tiers_new(id);