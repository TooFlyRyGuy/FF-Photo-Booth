/*
  # Update Canonical Pricing Structure

  ## Overview
  Complete pricing overhaul to implement new pricing strategy with clear separation:
  - Credit Top-Ups: Permanent fuel (never expire)
  - Event Passes: Time-bound event access with starter credits
  - Activation Plans: Monthly subscriptions for large ongoing activations
  - Regular Subscriptions: Monthly/annual plans (updated prompt limits)

  ## Changes

  ### 1. Credit Top-Up Products (4 tiers, never expire)
  - Small Boost: $49 (120 credits each)
  - Creator Pack: $129 (350 credits each)
  - Pro Boost: $279 (900 credits each)
  - Power Pack: $499 (1,800 credits each)

  ### 2. Event Passes (4 tiers, time-bound access)
  - Starter Event: $150 (24h, 3 prompts, 100/150 credits)
  - Pro Event: $280 (48h, 6 prompts, 200/300 credits)
  - Premium Event: $520 (72h, unlimited prompts, 400/600 credits)
  - Platinum Event: $900 (96h, unlimited prompts, 750/1200 credits)

  ### 3. Activation Plans (new category for large activations)
  - Activation 2.5K: $699/month (2,500/2,000 credits, up to 5 events)
  - Activation 5K: $1,299/month (5,000/4,000 credits, unlimited events)

  ### 4. Subscription Tiers (update prompt limits)
  - Starter: 3 prompts
  - Pro: 6 prompts
  - Premium: 9 prompts
  - Platinum: 12 prompts

  ## Important Notes
  - Credits never expire (they are fuel, not access)
  - Event passes are required to create/activate events
  - Top-up credits can be used during events but don't grant event access
  - Activation plans are for always-on or recurring brand activations
*/

-- ============================================================================
-- STEP 1: Update Credit Top-Up Products (Permanent Fuel)
-- ============================================================================

-- Clear existing credit topup products to rebuild from scratch
DELETE FROM credit_topup_products;

-- Insert new 4-tier structure
INSERT INTO credit_topup_products (name, credits, sms_credits, price_cents, is_active, display_order)
VALUES
('Small Boost', 120, 120, 4900, true, 1),
('Creator Pack', 350, 350, 12900, true, 2),
('Pro Boost', 900, 900, 27900, true, 3),
('Power Pack', 1800, 1800, 49900, true, 4);

-- ============================================================================
-- STEP 2: Add new columns to event_passes for enhanced features
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_passes' AND column_name = 'events_allowed'
  ) THEN
    ALTER TABLE event_passes ADD COLUMN events_allowed integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_passes' AND column_name = 'deterministic_seeds'
  ) THEN
    ALTER TABLE event_passes ADD COLUMN deterministic_seeds boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_passes' AND column_name = 'priority_queue'
  ) THEN
    ALTER TABLE event_passes ADD COLUMN priority_queue boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_passes' AND column_name = 'prompt_locking'
  ) THEN
    ALTER TABLE event_passes ADD COLUMN prompt_locking boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_passes' AND column_name = 'admin_controls'
  ) THEN
    ALTER TABLE event_passes ADD COLUMN admin_controls boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_passes' AND column_name = 'brand_locking'
  ) THEN
    ALTER TABLE event_passes ADD COLUMN brand_locking boolean DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Update Event Passes (Time-Bound Access)
-- ============================================================================

-- Clear existing event passes to rebuild
DELETE FROM event_passes;

-- Insert new 4-tier event pass structure
INSERT INTO event_passes (
  name,
  price_cents,
  credits,
  sms_credits,
  duration_hours,
  prompts_limit,
  events_allowed,
  deterministic_seeds,
  priority_queue,
  prompt_locking,
  admin_controls,
  brand_locking,
  features,
  is_active,
  display_order
) VALUES
(
  'Starter Event',
  15000,
  100,
  150,
  24,
  3,
  1,
  false,
  false,
  false,
  false,
  false,
  '[
    "1 event allowed",
    "24-hour event window",
    "3 prompt limit",
    "100 image credits included",
    "150 SMS credits included",
    "Standard generation queue"
  ]'::jsonb,
  true,
  1
),
(
  'Pro Event',
  28000,
  200,
  300,
  48,
  6,
  1,
  false,
  true,
  false,
  false,
  false,
  '[
    "1 event allowed",
    "48-hour event window",
    "6 prompt limit",
    "200 image credits included",
    "300 SMS credits included",
    "Priority generation queue"
  ]'::jsonb,
  true,
  2
),
(
  'Premium Event',
  52000,
  400,
  600,
  72,
  0,
  1,
  true,
  true,
  true,
  false,
  false,
  '[
    "1 event allowed",
    "72-hour event window",
    "Unlimited prompts",
    "400 image credits included",
    "600 SMS credits included",
    "Deterministic seeds",
    "Prompt locking",
    "Priority generation queue"
  ]'::jsonb,
  true,
  3
),
(
  'Platinum Event',
  90000,
  750,
  1200,
  96,
  0,
  1,
  true,
  true,
  true,
  true,
  true,
  '[
    "1 event allowed",
    "96-hour event window",
    "Unlimited prompts",
    "750 image credits included",
    "1,200 SMS credits included",
    "Deterministic seeds",
    "Advanced admin controls",
    "Brand locking",
    "Highest priority queue"
  ]'::jsonb,
  true,
  4
);

-- ============================================================================
-- STEP 4: Add columns for Activation Plans to subscription_tiers_new
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers_new' AND column_name = 'concurrent_events'
  ) THEN
    ALTER TABLE subscription_tiers_new ADD COLUMN concurrent_events integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers_new' AND column_name = 'deterministic_seeds'
  ) THEN
    ALTER TABLE subscription_tiers_new ADD COLUMN deterministic_seeds boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers_new' AND column_name = 'priority_queue'
  ) THEN
    ALTER TABLE subscription_tiers_new ADD COLUMN priority_queue boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers_new' AND column_name = 'brand_controls'
  ) THEN
    ALTER TABLE subscription_tiers_new ADD COLUMN brand_controls boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers_new' AND column_name = 'team_accounts'
  ) THEN
    ALTER TABLE subscription_tiers_new ADD COLUMN team_accounts boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers_new' AND column_name = 'tier_category'
  ) THEN
    ALTER TABLE subscription_tiers_new ADD COLUMN tier_category text DEFAULT 'standard' CHECK (tier_category IN ('standard', 'activation'));
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Update existing subscription tiers with prompt limits
-- ============================================================================

-- Update Starter plans
UPDATE subscription_tiers_new
SET prompts_limit = 3
WHERE name ILIKE '%starter%' AND tier_category = 'standard';

-- Update Pro plans
UPDATE subscription_tiers_new
SET prompts_limit = 6
WHERE name ILIKE '%pro%' AND tier_category = 'standard';

-- Update Premium plans
UPDATE subscription_tiers_new
SET prompts_limit = 9
WHERE name ILIKE '%premium%' AND tier_category = 'standard';

-- Update Platinum plans
UPDATE subscription_tiers_new
SET prompts_limit = 12
WHERE name ILIKE '%platinum%' AND tier_category = 'standard';

-- ============================================================================
-- STEP 6: Create Activation Plans (Large Ongoing Activations)
-- ============================================================================

-- Insert Activation 2.5K plan
INSERT INTO subscription_tiers_new (
  name,
  billing_period,
  price_cents,
  credits_per_period,
  sms_credits_per_period,
  prompts_limit,
  concurrent_events,
  deterministic_seeds,
  priority_queue,
  brand_controls,
  team_accounts,
  tier_category,
  rollover_enabled,
  features,
  is_active,
  display_order
) VALUES (
  'Activation 2.5K',
  'monthly',
  69900,
  2500,
  2000,
  0,
  5,
  true,
  true,
  false,
  false,
  'activation',
  false,
  '[
    "2,500 image credits per month",
    "2,000 SMS credits per month",
    "Up to 5 concurrent events",
    "Always-on event duration",
    "Unlimited prompts",
    "Deterministic seeds",
    "Priority generation queue",
    "Admin dashboard"
  ]'::jsonb,
  true,
  100
)
ON CONFLICT (name, billing_period) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  credits_per_period = EXCLUDED.credits_per_period,
  sms_credits_per_period = EXCLUDED.sms_credits_per_period,
  prompts_limit = EXCLUDED.prompts_limit,
  concurrent_events = EXCLUDED.concurrent_events,
  features = EXCLUDED.features;

-- Insert Activation 5K plan
INSERT INTO subscription_tiers_new (
  name,
  billing_period,
  price_cents,
  credits_per_period,
  sms_credits_per_period,
  prompts_limit,
  concurrent_events,
  deterministic_seeds,
  priority_queue,
  brand_controls,
  team_accounts,
  tier_category,
  rollover_enabled,
  features,
  is_active,
  display_order
) VALUES (
  'Activation 5K',
  'monthly',
  129900,
  5000,
  4000,
  0,
  999,
  true,
  true,
  true,
  true,
  'activation',
  false,
  '[
    "5,000 image credits per month",
    "4,000 SMS credits per month",
    "Unlimited concurrent events",
    "Always-on event duration",
    "Unlimited prompts",
    "Deterministic seeds",
    "Brand controls & governance",
    "Team accounts",
    "Highest priority queue",
    "Dedicated support"
  ]'::jsonb,
  true,
  101
)
ON CONFLICT (name, billing_period) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  credits_per_period = EXCLUDED.credits_per_period,
  sms_credits_per_period = EXCLUDED.sms_credits_per_period,
  prompts_limit = EXCLUDED.prompts_limit,
  concurrent_events = EXCLUDED.concurrent_events,
  features = EXCLUDED.features;

-- ============================================================================
-- STEP 7: Add indexes for new columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_event_passes_deterministic ON event_passes(deterministic_seeds);
CREATE INDEX IF NOT EXISTS idx_event_passes_priority ON event_passes(priority_queue);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_category ON subscription_tiers_new(tier_category);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_concurrent ON subscription_tiers_new(concurrent_events);

-- ============================================================================
-- STEP 8: Update add_ons to ensure Branded Gallery is correct
-- ============================================================================

UPDATE add_ons
SET
  name = 'Branded Photo Gallery',
  description = 'Professional branded photo gallery for your event with custom branding, domain, and premium features',
  price_cents = 4900,
  delivery_method = 'email',
  is_active = true
WHERE name = 'Branded Photo Gallery';
