/*
  # Create Subscription Management System
  
  1. New Tables
    - `subscription_tiers`
      - Stores Monthly and Annual subscription plan tiers only
      - Includes credit limits, pricing, and Stripe metadata
      - Separate from event_passes which already exist
    
    - `user_subscriptions`
      - Tracks active monthly/annual subscriptions for users
      - Links users to their subscription tier
      - Includes billing period, renewal dates, and Stripe subscription ID
    
    - `purchased_event_passes`
      - Tracks user purchases of event passes
      - One-time purchases with expiration
      - Links to event_passes table for tier info and events table for assignment
      - Tracks credit usage, prompt usage, and expiration
    
    - `event_pass_addons`
      - Tracks add-ons purchased for event passes
      - Links to add_ons table and purchased_event_passes
  
  2. Changes to Existing Tables
    - `user_credits`
      - Add `plan_type` (free/monthly/annual/event)
      - Add `subscription_tier_id` reference
      - Add `purchased_event_pass_id` reference
      - Add `expires_at` for event passes
      - Add `annual_credits_total` for annual plans
      - Add `annual_credits_used` for annual plans
      - Add `billing_period_start` for tracking resets
      - Add `billing_period_end` for tracking resets
  
  3. Security
    - Enable RLS on all new tables
    - Users can view their own subscriptions and passes
    - Admins can view and manage all subscriptions
*/

-- Create subscription_tiers table (Monthly and Annual plans only)
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('monthly', 'annual')),
  tier text NOT NULL CHECK (tier IN ('starter', 'pro', 'premium', 'agency')),
  price_cents integer NOT NULL,
  credits_per_period integer NOT NULL,
  stripe_product_id text UNIQUE,
  stripe_price_id text UNIQUE,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  description text,
  features jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_type, tier)
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES subscription_tiers(id),
  stripe_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create purchased_event_passes table (user purchases of event passes)
CREATE TABLE IF NOT EXISTS purchased_event_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  event_pass_tier_id uuid NOT NULL REFERENCES event_passes(id),
  stripe_payment_intent_id text,
  credits_allocated integer NOT NULL,
  credits_used integer DEFAULT 0,
  prompt_limit integer NOT NULL,
  prompts_used integer DEFAULT 0,
  purchased_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create event_pass_addons table (purchased add-ons for event passes)
CREATE TABLE IF NOT EXISTS event_pass_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchased_event_pass_id uuid NOT NULL REFERENCES purchased_event_passes(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES add_ons(id),
  stripe_payment_intent_id text,
  purchased_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Update user_credits table with new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'plan_type'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN plan_type text DEFAULT 'free' CHECK (plan_type IN ('free', 'monthly', 'annual', 'event', 'topup'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'subscription_tier_id'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN subscription_tier_id uuid;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'purchased_event_pass_id'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN purchased_event_pass_id uuid;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN expires_at timestamptz DEFAULT NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'annual_credits_total'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN annual_credits_total integer DEFAULT NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'annual_credits_used'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN annual_credits_used integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'billing_period_start'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN billing_period_start timestamptz DEFAULT NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'billing_period_end'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN billing_period_end timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Add foreign key constraints after columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_credits_subscription_tier_id_fkey'
  ) THEN
    ALTER TABLE user_credits ADD CONSTRAINT user_credits_subscription_tier_id_fkey 
      FOREIGN KEY (subscription_tier_id) REFERENCES subscription_tiers(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_credits_purchased_event_pass_id_fkey'
  ) THEN
    ALTER TABLE user_credits ADD CONSTRAINT user_credits_purchased_event_pass_id_fkey 
      FOREIGN KEY (purchased_event_pass_id) REFERENCES purchased_event_passes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchased_event_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_pass_addons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_tiers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscription_tiers' AND policyname = 'Anyone can view active subscription tiers'
  ) THEN
    CREATE POLICY "Anyone can view active subscription tiers"
      ON subscription_tiers FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscription_tiers' AND policyname = 'Admins can manage subscription tiers'
  ) THEN
    CREATE POLICY "Admins can manage subscription tiers"
      ON subscription_tiers FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND LOWER(user_profiles.role) = 'admin'
        )
      );
  END IF;
END $$;

-- RLS Policies for user_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_subscriptions' AND policyname = 'Users can view own subscriptions'
  ) THEN
    CREATE POLICY "Users can view own subscriptions"
      ON user_subscriptions FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_subscriptions' AND policyname = 'Admins can view all subscriptions'
  ) THEN
    CREATE POLICY "Admins can view all subscriptions"
      ON user_subscriptions FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND LOWER(user_profiles.role) = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_subscriptions' AND policyname = 'Admins can manage subscriptions'
  ) THEN
    CREATE POLICY "Admins can manage subscriptions"
      ON user_subscriptions FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND LOWER(user_profiles.role) = 'admin'
        )
      );
  END IF;
END $$;

-- RLS Policies for purchased_event_passes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchased_event_passes' AND policyname = 'Users can view own purchased event passes'
  ) THEN
    CREATE POLICY "Users can view own purchased event passes"
      ON purchased_event_passes FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchased_event_passes' AND policyname = 'Admins can view all purchased event passes'
  ) THEN
    CREATE POLICY "Admins can view all purchased event passes"
      ON purchased_event_passes FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND LOWER(user_profiles.role) = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchased_event_passes' AND policyname = 'Admins can manage purchased event passes'
  ) THEN
    CREATE POLICY "Admins can manage purchased event passes"
      ON purchased_event_passes FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND LOWER(user_profiles.role) = 'admin'
        )
      );
  END IF;
END $$;

-- RLS Policies for event_pass_addons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_pass_addons' AND policyname = 'Users can view own event pass addons'
  ) THEN
    CREATE POLICY "Users can view own event pass addons"
      ON event_pass_addons FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM purchased_event_passes
          WHERE purchased_event_passes.id = event_pass_addons.purchased_event_pass_id
          AND purchased_event_passes.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_pass_addons' AND policyname = 'Admins can view all event pass addons'
  ) THEN
    CREATE POLICY "Admins can view all event pass addons"
      ON event_pass_addons FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND LOWER(user_profiles.role) = 'admin'
        )
      );
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_purchased_event_passes_user_id ON purchased_event_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_purchased_event_passes_event_id ON purchased_event_passes(event_id);
CREATE INDEX IF NOT EXISTS idx_purchased_event_passes_expires_at ON purchased_event_passes(expires_at);
CREATE INDEX IF NOT EXISTS idx_event_pass_addons_purchased_event_pass_id ON event_pass_addons(purchased_event_pass_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_subscription_tier_id ON user_credits(subscription_tier_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_purchased_event_pass_id ON user_credits(purchased_event_pass_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_expires_at ON user_credits(expires_at);

-- Insert subscription tier data for Monthly and Annual plans
INSERT INTO subscription_tiers (name, plan_type, tier, price_cents, credits_per_period, display_order, description, features) VALUES
-- Monthly Subscriptions
('Starter Monthly', 'monthly', 'starter', 2900, 60, 1, 'Perfect for trying out Fun Frame Photo', '["60 images per month", "Hard cap - no overages", "Monthly reset", "All core features"]'::jsonb),
('Pro Monthly', 'monthly', 'pro', 8900, 250, 2, 'Great for regular event photographers', '["250 images per month", "Hard cap - no overages", "Monthly reset", "Priority support"]'::jsonb),
('Premium Monthly', 'monthly', 'premium', 14900, 500, 3, 'For busy professionals', '["500 images per month", "Hard cap - no overages", "Monthly reset", "Priority support", "Advanced features"]'::jsonb),
('Agency Monthly', 'monthly', 'agency', 29900, 1000, 4, 'For agencies and high-volume users', '["1,000 images per month", "Hard cap - no overages", "Monthly reset", "Dedicated support", "All features"]'::jsonb),

-- Annual Subscriptions (Prepaid with soft monthly pacing)
('Starter Annual', 'annual', 'starter', 29000, 720, 5, 'Save 17% with annual billing', '["720 images per year", "~60 per month soft pacing", "Prepaid - no refunds", "All core features", "Annual savings"]'::jsonb),
('Pro Annual', 'annual', 'pro', 89000, 3000, 6, 'Save 17% with annual billing', '["3,000 images per year", "~250 per month soft pacing", "Prepaid - no refunds", "Priority support", "Annual savings"]'::jsonb),
('Premium Annual', 'annual', 'premium', 149000, 6000, 7, 'Save 17% with annual billing', '["6,000 images per year", "~500 per month soft pacing", "Prepaid - no refunds", "Priority support", "Annual savings"]'::jsonb),
('Agency Annual', 'annual', 'agency', 299000, 12000, 8, 'Save 17% with annual billing', '["12,000 images per year", "~1,000 per month soft pacing", "Prepaid - no refunds", "Dedicated support", "Annual savings"]'::jsonb)
ON CONFLICT (plan_type, tier) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  credits_per_period = EXCLUDED.credits_per_period,
  display_order = EXCLUDED.display_order,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  updated_at = now();
