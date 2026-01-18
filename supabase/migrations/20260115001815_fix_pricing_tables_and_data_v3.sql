/*
  # Fix Pricing Tables and Populate with Correct Data (v3)

  ## Overview
  This migration updates the subscription pricing tables with the correct
  schema and populates them with the user's actual pricing data.

  ## Changes

  ### 1. Update subscription_tiers_new Table Schema
  - Add sms_credits_per_period column for SMS credit tracking
  - Ensure all necessary fields exist for pricing display

  ### 2. Populate Monthly Subscriptions
  - Starter: $29/mo, 60 image + 50 SMS credits, 3 prompts
  - Pro: $79/mo, 200 image + 150 SMS credits, 6 prompts
  - Premium: $149/mo, 450 image + 300 SMS credits, 9 prompts
  - Platinum: $299/mo, 1000 image + 750 SMS credits, 12 prompts

  ### 3. Populate Annual Subscriptions
  - Starter: $299/yr, 720 image + 600 SMS credits, 3 prompts
  - Pro: $799/yr, 2400 image + 1800 SMS credits, 6 prompts
  - Premium: $1,499/yr, 5400 image + 3600 SMS credits, 9 prompts
  - Platinum: $2,999/yr, 12000 image + 9000 SMS credits, 12 prompts

  ### 4. Populate Event Passes
  - Event Pass 150: $150, 150 credits, 24 hours
  - Event Pass Mid: $300, 300 credits, 48 hours
  - Event Pass Platinum: $600, 600 credits, 72 hours

  ### 5. Populate Credit Top-up Products
  - Small: $25, 50 image + 25 SMS credits
  - Medium: $59, 150 image + 75 SMS credits
  - Large: $99, 300 image + 150 SMS credits
  - XL: $199, 700 image + 350 SMS credits

  ## Important Notes
  - Credits are split into image and SMS credits
  - Annual subscriptions provide 12 months worth of monthly credits
  - Uses UPSERT to preserve foreign key references
*/

-- ============================================================================
-- STEP 1: Add missing columns to subscription_tiers_new
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers_new' AND column_name = 'sms_credits_per_period'
  ) THEN
    ALTER TABLE subscription_tiers_new ADD COLUMN sms_credits_per_period integer DEFAULT 0;
  END IF;
END $$;

-- Add unique constraint for upsert operations if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'subscription_tiers_new_name_billing_period_key'
  ) THEN
    ALTER TABLE subscription_tiers_new 
    ADD CONSTRAINT subscription_tiers_new_name_billing_period_key 
    UNIQUE (name, billing_period);
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Upsert subscription_tiers_new with correct pricing
-- ============================================================================

-- Insert/Update Monthly Subscriptions
INSERT INTO subscription_tiers_new (name, billing_period, price_cents, credits_per_period, sms_credits_per_period, rollover_enabled, features, prompts_limit, is_active, display_order) VALUES
('Starter', 'monthly', 2900, 60, 50, false, '["60 AI image generations per month", "50 SMS messages per month", "3 prompt slots per event", "Basic support", "Monthly reset"]'::jsonb, 3, true, 1),
('Pro', 'monthly', 7900, 200, 150, false, '["200 AI image generations per month", "150 SMS messages per month", "6 prompt slots per event", "Priority support", "Monthly reset"]'::jsonb, 6, true, 2),
('Premium', 'monthly', 14900, 450, 300, false, '["450 AI image generations per month", "300 SMS messages per month", "9 prompt slots per event", "Priority support", "Advanced features", "Monthly reset"]'::jsonb, 9, true, 3),
('Platinum', 'monthly', 29900, 1000, 750, false, '["1,000 AI image generations per month", "750 SMS messages per month", "12 prompt slots per event", "Dedicated support", "All features", "Monthly reset"]'::jsonb, 12, true, 4)
ON CONFLICT (name, billing_period) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  credits_per_period = EXCLUDED.credits_per_period,
  sms_credits_per_period = EXCLUDED.sms_credits_per_period,
  rollover_enabled = EXCLUDED.rollover_enabled,
  features = EXCLUDED.features,
  prompts_limit = EXCLUDED.prompts_limit,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- Insert/Update Annual Subscriptions
INSERT INTO subscription_tiers_new (name, billing_period, price_cents, credits_per_period, sms_credits_per_period, rollover_enabled, features, prompts_limit, is_active, display_order) VALUES
('Starter', 'annual', 29900, 720, 600, false, '["720 AI image generations per year", "600 SMS messages per year", "~60 images per month", "~50 SMS per month", "3 prompt slots per event", "Basic support", "Save with annual billing"]'::jsonb, 3, true, 5),
('Pro', 'annual', 79900, 2400, 1800, false, '["2,400 AI image generations per year", "1,800 SMS messages per year", "~200 images per month", "~150 SMS per month", "6 prompt slots per event", "Priority support", "Save with annual billing"]'::jsonb, 6, true, 6),
('Premium', 'annual', 149900, 5400, 3600, false, '["5,400 AI image generations per year", "3,600 SMS messages per year", "~450 images per month", "~300 SMS per month", "9 prompt slots per event", "Priority support", "Advanced features", "Save with annual billing"]'::jsonb, 9, true, 7),
('Platinum', 'annual', 299900, 12000, 9000, false, '["12,000 AI image generations per year", "9,000 SMS messages per year", "~1,000 images per month", "~750 SMS per month", "12 prompt slots per event", "Dedicated support", "All features", "Save with annual billing"]'::jsonb, 12, true, 8)
ON CONFLICT (name, billing_period) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  credits_per_period = EXCLUDED.credits_per_period,
  sms_credits_per_period = EXCLUDED.sms_credits_per_period,
  rollover_enabled = EXCLUDED.rollover_enabled,
  features = EXCLUDED.features,
  prompts_limit = EXCLUDED.prompts_limit,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- ============================================================================
-- STEP 3: Add sms_credits column to event_passes
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_passes' AND column_name = 'sms_credits'
  ) THEN
    ALTER TABLE event_passes ADD COLUMN sms_credits integer DEFAULT 0;
  END IF;
END $$;

-- Add unique constraint for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'event_passes_name_key'
  ) THEN
    ALTER TABLE event_passes 
    ADD CONSTRAINT event_passes_name_key 
    UNIQUE (name);
  END IF;
END $$;

-- Upsert event passes
INSERT INTO event_passes (name, price_cents, credits, sms_credits, duration_hours, prompts_limit, features, is_active, display_order) VALUES
('Event Pass – 150 Generations', 15000, 150, 150, 24, 10, '["150 AI image generations", "150 SMS messages", "24-hour access", "Perfect for single events", "No long-term commitment"]'::jsonb, true, 1),
('Event Pass – Mid Tier', 30000, 300, 300, 48, 15, '["300 AI image generations", "300 SMS messages", "48-hour access", "Great for weekend events", "Extended duration"]'::jsonb, true, 2),
('Event Pass – Platinum', 60000, 600, 650, 72, 20, '["600+ AI image generations", "650 SMS messages", "72-hour access", "Perfect for multi-day events", "Premium features"]'::jsonb, true, 3)
ON CONFLICT (name) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  credits = EXCLUDED.credits,
  sms_credits = EXCLUDED.sms_credits,
  duration_hours = EXCLUDED.duration_hours,
  prompts_limit = EXCLUDED.prompts_limit,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;

-- ============================================================================
-- STEP 4: Add sms_credits column to credit_topup_products
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_topup_products' AND column_name = 'sms_credits'
  ) THEN
    ALTER TABLE credit_topup_products ADD COLUMN sms_credits integer DEFAULT 0;
  END IF;
END $$;

-- Add unique constraint for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'credit_topup_products_name_key'
  ) THEN
    ALTER TABLE credit_topup_products 
    ADD CONSTRAINT credit_topup_products_name_key 
    UNIQUE (name);
  END IF;
END $$;

-- Upsert credit topup products
INSERT INTO credit_topup_products (name, credits, sms_credits, price_cents, is_active, display_order) VALUES
('Small Credit Pack', 50, 25, 2500, true, 1),
('Medium Credit Pack', 150, 75, 5900, true, 2),
('Large Credit Pack', 300, 150, 9900, true, 3),
('XL Credit Pack', 700, 350, 19900, true, 4)
ON CONFLICT (name) DO UPDATE SET
  credits = EXCLUDED.credits,
  sms_credits = EXCLUDED.sms_credits,
  price_cents = EXCLUDED.price_cents,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;

-- ============================================================================
-- STEP 5: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscription_tiers_new_active_display ON subscription_tiers_new(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_new_billing_period ON subscription_tiers_new(billing_period);
CREATE INDEX IF NOT EXISTS idx_event_passes_active_display ON event_passes(is_active, display_order);
