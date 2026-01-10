/*
  # Add Unique Constraints for Stripe Product IDs

  1. Changes
    - Add unique constraint on stripe_product_id in subscription_tiers table
    - Add unique constraint on stripe_product_id in credit_topup_products table
    - Add unique constraint on stripe_product_id in event_passes table
    - Add unique constraint on stripe_product_id in add_ons table
  
  2. Purpose
    - Enable upsert operations when syncing Stripe products
    - Prevent duplicate product entries from Stripe
*/

-- Add unique constraint to subscription_tiers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'subscription_tiers_stripe_product_id_key'
  ) THEN
    ALTER TABLE subscription_tiers 
    ADD CONSTRAINT subscription_tiers_stripe_product_id_key 
    UNIQUE (stripe_product_id);
  END IF;
END $$;

-- Add unique constraint to credit_topup_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'credit_topup_products_stripe_product_id_key'
  ) THEN
    ALTER TABLE credit_topup_products 
    ADD CONSTRAINT credit_topup_products_stripe_product_id_key 
    UNIQUE (stripe_product_id);
  END IF;
END $$;

-- Add unique constraint to event_passes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'event_passes_stripe_product_id_key'
  ) THEN
    ALTER TABLE event_passes 
    ADD CONSTRAINT event_passes_stripe_product_id_key 
    UNIQUE (stripe_product_id);
  END IF;
END $$;

-- Add unique constraint to add_ons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'add_ons_stripe_product_id_key'
  ) THEN
    ALTER TABLE add_ons 
    ADD CONSTRAINT add_ons_stripe_product_id_key 
    UNIQUE (stripe_product_id);
  END IF;
END $$;
