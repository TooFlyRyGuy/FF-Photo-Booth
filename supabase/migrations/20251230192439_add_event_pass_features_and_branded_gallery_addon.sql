/*
  # Add Event Pass Features and Branded Photo Gallery Add-On

  ## Overview
  This migration adds a features field to event passes and creates a new add-on product
  for "Branded Photo Gallery" service.

  ## Changes

  ### 1. Add features Column to event_passes
  - `features` (jsonb, nullable) - Array of features included with the event pass
  - Similar to subscription_tiers_new features field

  ### 2. Create Branded Photo Gallery Add-On
  - Name: "Branded Photo Gallery"
  - Price: $49.00
  - Description: Professional branded photo gallery for your event
  - Delivery method: email
  - Active by default

  ## Important Notes
  - Features field allows event passes to have detailed feature lists like subscription tiers
  - The new add-on provides custom gallery branding service
*/

-- ============================================================================
-- STEP 1: Add features column to event_passes
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_passes' AND column_name = 'features'
  ) THEN
    ALTER TABLE event_passes 
    ADD COLUMN features jsonb DEFAULT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create Branded Photo Gallery add-on
-- ============================================================================

INSERT INTO add_ons (
  id,
  name,
  description,
  price_cents,
  delivery_method,
  duration_minutes,
  is_active,
  created_at
)
VALUES (
  gen_random_uuid(),
  'Branded Photo Gallery',
  'Professional branded photo gallery for your event with custom branding, domain, and premium features',
  4900, -- $49.00
  'email',
  NULL, -- No specific duration for this service
  true,
  now()
)
ON CONFLICT (id) DO NOTHING;
