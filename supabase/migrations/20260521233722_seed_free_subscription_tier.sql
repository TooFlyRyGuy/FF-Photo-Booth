/*
  # Seed Free Subscription Tier

  ## Summary
  Inserts the required "Free" subscription tier into subscription_tiers_new.
  The handle_new_user trigger requires an active Free tier to exist or it raises
  an exception, causing "Database error saving new user" on every user creation.

  ## Changes
  - Inserts a Free tier row with is_active = true if one does not already exist
  - Sets sensible defaults matching the values the trigger seeds into user_credits:
    10 image credits, 10 SMS credits, 1 concurrent event, 1 prompt limit

  ## Also updates handle_new_user trigger to be resilient:
  - If no Free tier is found, inserts user without a tier rather than raising an exception
*/

INSERT INTO subscription_tiers_new (
  name,
  billing_period,
  price_cents,
  credits_per_period,
  sms_credits_per_period,
  concurrent_events,
  prompts_limit,
  is_active,
  display_order,
  tier_category,
  features
)
SELECT
  'Free',
  'monthly',
  0,
  10,
  10,
  1,
  1,
  true,
  0,
  'standard',
  '["Basic photo booth", "10 AI image credits/month", "1 event"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_tiers_new WHERE name = 'Free'
);

-- Make handle_new_user resilient: skip the hard exception if Free tier is missing
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_free_tier_id uuid;
v_credit_balance integer;
v_full_name text;
BEGIN
-- Get Free tier ID
SELECT id INTO v_free_tier_id
FROM subscription_tiers_new
WHERE name = 'Free' AND is_active = true
LIMIT 1;

-- Extract full_name from metadata or use email username as fallback
v_full_name := COALESCE(
NEW.raw_user_meta_data->>'full_name',
split_part(NEW.email, '@', 1)
);

-- Insert user profile (use free tier if found, otherwise null)
INSERT INTO user_profiles (
id,
email,
full_name,
subscription_tier_id,
subscription_status,
role
)
VALUES (
NEW.id,
NEW.email,
v_full_name,
v_free_tier_id,
'active',
'user'
)
ON CONFLICT (id) DO NOTHING;

-- Insert user credits
INSERT INTO user_credits (
user_id,
images_limit,
sms_limit,
events_limit,
images_used,
sms_used,
subscription_credits,
subscription_sms_credits,
purchased_credits,
purchased_sms_credits,
event_credits,
event_sms_credits,
reset_date
)
VALUES (
NEW.id,
10,
10,
1,
0,
0,
10,
10,
0,
0,
0,
0,
date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month'
)
ON CONFLICT (user_id) DO NOTHING;

-- Calculate initial balance
v_credit_balance := 10;

-- Create ledger entry for initial subscription credits
INSERT INTO credit_ledger (
user_id,
source,
amount,
balance_after,
metadata,
created_at
)
VALUES (
NEW.id,
'subscription',
10,
v_credit_balance,
jsonb_build_object(
'type', 'initial_signup',
'tier', 'Free',
'description', 'Initial FREE tier image credits'
),
now()
);

-- Create ledger entry for initial SMS credits
INSERT INTO credit_ledger (
user_id,
source,
amount,
balance_after,
metadata,
created_at
)
VALUES (
NEW.id,
'subscription',
10,
10,
jsonb_build_object(
'type', 'initial_signup',
'tier', 'Free',
'description', 'Initial FREE tier SMS credits'
),
now()
);

RETURN NEW;
END;
$function$;
