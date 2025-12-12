/*
  # Add ADMIN Subscription Tier

  1. New Subscription Tier
    - `admin` (id) - Hidden administrative tier with unlimited access
      - Unlimited images per month (999,999,999)
      - Unlimited SMS messages per month (999,999,999)
      - Unlimited events (999,999,999)
      - Full custom branding enabled
      - Full analytics access
      - Priority support enabled
      - Price: $0 (not purchasable, only assignable)

  2. Purpose
    - Allows platform administrators to have unrestricted access
    - Cannot be purchased through normal subscription flow
    - Must be manually assigned to users in the database

  3. Security
    - This tier is not exposed in the public subscription tiers list
    - Only accessible to users who have been explicitly assigned this tier
*/

-- Add ADMIN subscription tier to subscription_tiers table
INSERT INTO subscription_tiers (
  id, 
  name, 
  description, 
  price_monthly, 
  price_yearly, 
  images_limit, 
  sms_limit, 
  events_limit, 
  custom_branding, 
  analytics, 
  priority_support
)
VALUES (
  'admin',
  'Admin',
  'Administrative tier with unlimited access - not publicly available',
  0,
  0,
  999999999,
  999999999,
  999999999,
  true,
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  images_limit = EXCLUDED.images_limit,
  sms_limit = EXCLUDED.sms_limit,
  events_limit = EXCLUDED.events_limit,
  custom_branding = EXCLUDED.custom_branding,
  analytics = EXCLUDED.analytics,
  priority_support = EXCLUDED.priority_support;