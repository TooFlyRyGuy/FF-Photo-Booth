/*
  # Ensure Subscription Cancellation Support

  This migration ensures the database schema supports subscription cancellation functionality.
  
  1. Changes
    - Verifies cancel_at_period_end column exists in user_subscriptions table
    - Adds column if it doesn't exist (idempotent operation)
  
  2. Security
    - No changes to RLS policies (already configured)
    - No changes to existing data
*/

-- Ensure cancel_at_period_end column exists in user_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' 
    AND column_name = 'cancel_at_period_end'
  ) THEN
    ALTER TABLE user_subscriptions 
    ADD COLUMN cancel_at_period_end boolean DEFAULT false;
  END IF;
END $$;

-- Ensure the column has a default value
ALTER TABLE user_subscriptions 
ALTER COLUMN cancel_at_period_end SET DEFAULT false;

-- Add index for efficient querying of cancellation status
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_cancel_status 
ON user_subscriptions(user_id, status, cancel_at_period_end)
WHERE status IN ('active', 'trialing');
