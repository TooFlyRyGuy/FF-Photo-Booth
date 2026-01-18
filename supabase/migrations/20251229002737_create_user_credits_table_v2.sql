/*
  # Create User Credits Table

  ## Overview
  This migration creates a user-based credits tracking system to replace the tenant-based subscription_limits.

  ## Changes

  ### 1. New Table: user_credits
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - References user_profiles.id
  - `images_limit` (integer) - Monthly image generation limit
  - `images_used` (integer) - Current month usage
  - `sms_limit` (integer) - Monthly SMS limit
  - `sms_used` (integer) - Current month usage
  - `events_limit` (integer) - Active events limit
  - `reset_date` (timestamptz) - Next usage reset date
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on user_credits table
  - Users can only view and update their own credits
  - Authenticated users only

  ## Important Notes
  - Free tier users get: 10 images, 5 SMS, 1 event per month
  - Credits reset monthly based on reset_date
  - This table tracks usage independently per user, not per tenant
*/

-- ============================================================================
-- STEP 1: Drop existing table if exists
-- ============================================================================

DROP TABLE IF EXISTS user_credits CASCADE;

-- ============================================================================
-- STEP 2: Create user_credits table
-- ============================================================================

CREATE TABLE user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE UNIQUE,
  images_limit integer NOT NULL DEFAULT 10,
  images_used integer DEFAULT 0,
  sms_limit integer NOT NULL DEFAULT 5,
  sms_used integer DEFAULT 0,
  events_limit integer NOT NULL DEFAULT 1,
  reset_date timestamptz DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- STEP 3: Enable RLS
-- ============================================================================

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS policies
-- ============================================================================

CREATE POLICY "Users can view own credits"
  ON user_credits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own credits"
  ON user_credits FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can insert credits"
  ON user_credits FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- STEP 5: Create indexes
-- ============================================================================

CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_user_credits_reset_date ON user_credits(reset_date);

-- ============================================================================
-- STEP 6: Create trigger for updated_at
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE TRIGGER update_user_credits_updated_at 
      BEFORE UPDATE ON user_credits
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Create function to increment user image usage
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_user_image_usage(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE user_credits 
  SET images_used = images_used + 1
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 8: Create function to increment user SMS usage
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_user_sms_usage(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE user_credits 
  SET sms_used = sms_used + 1
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;