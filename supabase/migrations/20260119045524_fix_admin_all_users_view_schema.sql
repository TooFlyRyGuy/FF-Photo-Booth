/*
  # Fix admin_all_users View for New Subscription Schema

  1. Changes
    - Update admin_all_users view to work with new subscription system
    - Join with user_subscriptions table instead of referencing non-existent columns
    - Remove references to columns that no longer exist in user_profiles:
      - subscription_status
      - subscription_tier_id
      - stripe_customer_id
      - stripe_subscription_id
      - subscription_start_date
      - subscription_end_date
    - Add proper joins to get subscription information from user_subscriptions table

  2. Notes
    - This view is used by admins to see all users and their subscription status
    - Uses LEFT JOIN so users without subscriptions are still shown
    - Uses actual user_credits columns from the database
*/

DROP VIEW IF EXISTS admin_all_users;

CREATE VIEW admin_all_users
WITH (security_invoker = true)
AS
  SELECT
    up.id,
    up.email,
    up.full_name,
    up.display_name,
    up.role,
    up.created_at,
    up.updated_at,
    -- Subscription information from user_subscriptions table
    us.id AS subscription_id,
    us.status AS subscription_status,
    us.tier_id AS subscription_tier_id,
    st.name AS subscription_tier_name,
    st.plan_type,
    us.stripe_subscription_id,
    us.current_period_start AS subscription_start_date,
    us.current_period_end AS subscription_end_date,
    us.cancel_at_period_end,
    -- User credits information
    uc.images_limit,
    uc.images_used,
    uc.sms_limit,
    uc.sms_used,
    uc.events_limit,
    uc.reset_date,
    uc.subscription_credits,
    uc.purchased_credits,
    uc.event_credits,
    uc.subscription_sms_credits,
    uc.purchased_sms_credits,
    uc.event_sms_credits,
    -- Event and prompt counts
    (SELECT count(*) FROM public.events WHERE events.user_id = up.id) AS total_events,
    (SELECT count(*) FROM public.prompts WHERE prompts.user_id = up.id) AS total_prompts
  FROM public.user_profiles up
  LEFT JOIN public.user_subscriptions us ON up.id = us.user_id AND us.status = 'active'
  LEFT JOIN public.subscription_tiers st ON us.tier_id = st.id
  LEFT JOIN public.user_credits uc ON up.id = uc.user_id;

-- Grant access to admin view to authenticated users
-- RLS will control actual access (only admins should query this)
GRANT SELECT ON admin_all_users TO authenticated;
