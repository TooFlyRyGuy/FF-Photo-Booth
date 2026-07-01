-- Deactivate the duplicate Enterprise tier (the one with "Save 20%" feature line)
UPDATE subscription_tiers_new
SET is_active = false
WHERE id = 'ed6fc6de-a3e5-4de6-8ef6-44376db54d39';

-- Update the canonical Enterprise tier with full enterprise-level feature flags
UPDATE subscription_tiers_new
SET
  priority_queue = true,
  brand_controls = true,
  team_accounts = true,
  deterministic_seeds = true,
  concurrent_events = 999,
  features = '[
    "Unlimited image generations",
    "Unlimited concurrent events",
    "Unlimited prompts per event",
    "Priority processing queue",
    "Custom branding & brand controls",
    "Team accounts",
    "Dedicated account manager",
    "Priority support",
    "Custom integrations"
  ]'::jsonb
WHERE id = 'abfa3754-c2f1-41fb-af82-3e17276c530c';
