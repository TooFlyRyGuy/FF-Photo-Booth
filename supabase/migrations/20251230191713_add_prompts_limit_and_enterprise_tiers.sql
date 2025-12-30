/*
  # Add Prompts Limit and Enterprise Tiers

  ## Overview
  This migration adds the ability to limit the number of prompts users can use in their events
  based on their subscription tier or event pass. It also creates Enterprise-level plans that
  display "CONTACT US" instead of pricing information.

  ## Changes

  ### 1. Add prompts_limit Column to subscription_tiers_new
  - `prompts_limit` (integer, nullable) - Maximum number of prompts per event
  - NULL = unlimited prompts
  - Default existing tiers to reasonable limits

  ### 2. Add prompts_limit Column to event_passes
  - `prompts_limit` (integer, nullable) - Maximum number of prompts per event
  - NULL = unlimited prompts
  - Default existing passes to reasonable limits

  ### 3. Update Existing Subscription Tiers
  - Starter: 5 prompts per event
  - Pro: 10 prompts per event
  - Premium: 20 prompts per event

  ### 4. Update Existing Event Passes
  - Basic: 5 prompts per event
  - Plus: 10 prompts per event
  - Pro: 15 prompts per event
  - Multi-Event Pack: 20 prompts per event

  ### 5. Create Enterprise Subscription Tiers
  - Enterprise Monthly: Unlimited prompts, price_cents = -1 (indicates "CONTACT US")
  - Enterprise Annual: Unlimited prompts, price_cents = -1 (indicates "CONTACT US")

  ### 6. Create Enterprise Event Pass
  - Enterprise Event: Unlimited prompts, price_cents = -1 (indicates "CONTACT US")

  ## Important Notes
  - price_cents = -1 is a special indicator that the UI should display "CONTACT US"
  - prompts_limit = NULL means unlimited prompts
  - This does not affect credits - credits are still tracked separately
*/

-- ============================================================================
-- STEP 1: Add prompts_limit column to subscription_tiers_new
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers_new' AND column_name = 'prompts_limit'
  ) THEN
    ALTER TABLE subscription_tiers_new 
    ADD COLUMN prompts_limit integer DEFAULT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add prompts_limit column to event_passes
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_passes' AND column_name = 'prompts_limit'
  ) THEN
    ALTER TABLE event_passes 
    ADD COLUMN prompts_limit integer DEFAULT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Update existing subscription tiers with prompt limits
-- ============================================================================

-- Starter tiers: 5 prompts per event
UPDATE subscription_tiers_new
SET prompts_limit = 5
WHERE name = 'Starter';

-- Pro tiers: 10 prompts per event
UPDATE subscription_tiers_new
SET prompts_limit = 10
WHERE name = 'Pro';

-- Premium tiers: 20 prompts per event
UPDATE subscription_tiers_new
SET prompts_limit = 20
WHERE name = 'Premium';

-- ============================================================================
-- STEP 4: Update existing event passes with prompt limits
-- ============================================================================

-- Basic: 5 prompts
UPDATE event_passes
SET prompts_limit = 5
WHERE name = 'Single Event – Basic';

-- Plus: 10 prompts
UPDATE event_passes
SET prompts_limit = 10
WHERE name = 'Single Event – Plus';

-- Pro: 15 prompts
UPDATE event_passes
SET prompts_limit = 15
WHERE name = 'Single Event – Pro';

-- Multi-Event Pack: 20 prompts
UPDATE event_passes
SET prompts_limit = 20
WHERE name = 'Multi-Event Pack (3)';

-- ============================================================================
-- STEP 5: Create Enterprise subscription tiers
-- ============================================================================

-- Enterprise Monthly
INSERT INTO subscription_tiers_new (
  id,
  name,
  stripe_price_id,
  stripe_product_id,
  billing_period,
  price_cents,
  credits_per_period,
  rollover_enabled,
  features,
  prompts_limit,
  is_active,
  display_order,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'Enterprise',
  NULL, -- Will be set manually when customer contacts
  NULL, -- Will be set manually when customer contacts
  'monthly',
  -1, -- Special value indicating "CONTACT US"
  999999, -- Placeholder for unlimited
  true,
  '["Unlimited image generations", "Unlimited events", "Unlimited prompts per event", "Priority support", "Custom branding", "Dedicated account manager", "Custom integrations"]'::jsonb,
  NULL, -- NULL = unlimited prompts
  true,
  7,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Enterprise Annual
INSERT INTO subscription_tiers_new (
  id,
  name,
  stripe_price_id,
  stripe_product_id,
  billing_period,
  price_cents,
  credits_per_period,
  rollover_enabled,
  features,
  prompts_limit,
  is_active,
  display_order,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'Enterprise',
  NULL, -- Will be set manually when customer contacts
  NULL, -- Will be set manually when customer contacts
  'annual',
  -1, -- Special value indicating "CONTACT US"
  999999, -- Placeholder for unlimited
  true,
  '["Unlimited image generations", "Unlimited events", "Unlimited prompts per event", "Priority support", "Custom branding", "Dedicated account manager", "Custom integrations", "Save 20% with annual billing"]'::jsonb,
  NULL, -- NULL = unlimited prompts
  true,
  8,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 6: Create Enterprise event pass
-- ============================================================================

INSERT INTO event_passes (
  id,
  name,
  stripe_price_id,
  stripe_product_id,
  price_cents,
  credits,
  duration_hours,
  setup_included,
  prompts_limit,
  is_active,
  display_order,
  created_at
)
VALUES (
  gen_random_uuid(),
  'Single Event – Enterprise',
  NULL, -- Will be set manually when customer contacts
  NULL, -- Will be set manually when customer contacts
  -1, -- Special value indicating "CONTACT US"
  999999, -- Placeholder for unlimited
  168, -- 7 days
  true, -- Setup included
  NULL, -- NULL = unlimited prompts
  true,
  5,
  now()
)
ON CONFLICT (id) DO NOTHING;
