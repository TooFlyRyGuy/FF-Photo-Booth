-- Expand the tier_category check constraint to include 'enterprise'
ALTER TABLE subscription_tiers_new
  DROP CONSTRAINT subscription_tiers_new_tier_category_check;

ALTER TABLE subscription_tiers_new
  ADD CONSTRAINT subscription_tiers_new_tier_category_check
    CHECK (tier_category = ANY (ARRAY['standard'::text, 'activation'::text, 'enterprise'::text]));

-- Now set Enterprise plans to the correct category
UPDATE subscription_tiers_new
SET tier_category = 'enterprise'
WHERE name ILIKE 'enterprise';
