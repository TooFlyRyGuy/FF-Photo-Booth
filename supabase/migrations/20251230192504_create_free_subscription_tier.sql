/*
  # Create FREE Subscription Tier

  ## Overview
  This migration creates a FREE subscription tier that can be edited by administrators.

  ## Changes

  ### 1. Create Free Tier (Monthly)
  - Name: "Free"
  - Price: $0
  - Credits: 10 per month
  - Prompts: 3 per event
  - No rollover
  - Basic features

  ### 2. Create Free Tier (Annual)
  - Name: "Free"
  - Price: $0
  - Credits: 10 per year
  - Prompts: 3 per event
  - No rollover
  - Basic features

  ## Important Notes
  - Free tiers can be edited by admins to adjust what's included
  - Display order set to 0 to appear first
*/

-- ============================================================================
-- STEP 1: Create Free tier (Monthly)
-- ============================================================================

INSERT INTO subscription_tiers_new (
  id,
  name,
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
  'Free',
  'monthly',
  0,
  10,
  false,
  '["10 AI-generated photos per month", "3 prompts per event", "1 active event", "Basic support"]'::jsonb,
  3,
  true,
  0,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Create Free tier (Annual) 
-- ============================================================================

INSERT INTO subscription_tiers_new (
  id,
  name,
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
  'Free',
  'annual',
  0,
  10,
  false,
  '["10 AI-generated photos per year", "3 prompts per event", "1 active event", "Basic support"]'::jsonb,
  3,
  true,
  0,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;
