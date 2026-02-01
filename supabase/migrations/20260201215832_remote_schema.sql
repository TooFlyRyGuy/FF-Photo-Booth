drop extension if exists "pg_net";

drop policy "Anyone can view active add-ons" on "public"."add_ons";

drop policy "Anyone can view active topup products" on "public"."credit_topup_products";

drop policy "Anyone can view active passes" on "public"."event_passes";

drop policy "Anyone can read global settings" on "public"."global_settings";

drop policy "Anyone can view active tiers" on "public"."subscription_tiers";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.activate_pass(p_pass_id uuid, p_event_id uuid, p_user_id uuid)
 RETURNS TABLE(success boolean, expires_at timestamp with time zone, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_duration_hours integer;
v_pass_user_id uuid;
v_expiration timestamptz;
BEGIN
-- Verify pass belongs to user and is not already activated
SELECT 
uep.user_id,
ep.duration_hours
INTO v_pass_user_id, v_duration_hours
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.id = p_pass_id;

-- Check if pass exists
IF NOT FOUND THEN
RETURN QUERY SELECT false, NULL::timestamptz, 'Pass not found';
RETURN;
END IF;

-- Check if pass belongs to user
IF v_pass_user_id != p_user_id THEN
RETURN QUERY SELECT false, NULL::timestamptz, 'Pass does not belong to user';
RETURN;
END IF;

-- Check if pass has duration
IF v_duration_hours IS NULL THEN
RETURN QUERY SELECT false, NULL::timestamptz, 'Pass does not have duration';
RETURN;
END IF;

-- Calculate expiration
v_expiration := NOW() + (v_duration_hours || ' hours')::interval;

-- Activate the pass
UPDATE user_event_passes
SET 
activated_at = NOW(),
event_id = p_event_id,
expires_at = v_expiration,
is_active = true
WHERE id = p_pass_id
AND activated_at IS NULL;

-- Check if update was successful
IF NOT FOUND THEN
RETURN QUERY SELECT false, NULL::timestamptz, 'Pass already activated';
RETURN;
END IF;

RETURN QUERY SELECT true, v_expiration, 'Pass activated successfully';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_event_pass_credits(p_user_id uuid, p_credits integer, p_pass_id uuid, p_stripe_payment_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
-- Insert into credit ledger
INSERT INTO credit_ledger (
user_id,
credit_type,
amount,
source_type,
source_id,
description
) VALUES (
p_user_id,
'event_pass',
p_credits,
'stripe_payment',
p_stripe_payment_id,
'Event pass image credits - Pass ID: ' || p_pass_id
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_event_pass_sms_credits(p_user_id uuid, p_sms_credits integer, p_pass_id uuid, p_stripe_payment_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
-- Insert into SMS credit ledger
INSERT INTO sms_credit_ledger (
user_id,
credit_type,
amount,
source_type,
source_id,
description
) VALUES (
p_user_id,
'event_pass',
p_sms_credits,
'stripe_payment',
p_stripe_payment_id,
'Event pass SMS credits - Pass ID: ' || p_pass_id
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_purchased_credits(p_user_id uuid, p_credits integer, p_stripe_session_id text DEFAULT NULL::text, p_stripe_payment_intent_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_total_credits integer;
BEGIN
-- Add credits to purchased_credits
UPDATE user_credits
SET purchased_credits = COALESCE(purchased_credits, 0) + p_credits,
updated_at = now()
WHERE user_id = p_user_id;

-- Get new total balance
SELECT get_total_credits(p_user_id) INTO v_total_credits;

-- Log to credit ledger
INSERT INTO credit_ledger (
user_id,
source,
amount,
balance_after,
stripe_session_id,
stripe_payment_intent_id,
metadata
)
VALUES (
p_user_id,
'credit_pack',
p_credits,
v_total_credits,
p_stripe_session_id,
p_stripe_payment_intent_id,
jsonb_build_object('expires', 'never')
);

RETURN jsonb_build_object(
'success', true,
'credits_added', p_credits,
'new_balance', v_total_credits
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_purchased_sms_credits(p_user_id uuid, p_sms_credits integer, p_stripe_session_id text DEFAULT NULL::text, p_stripe_payment_intent_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_total_sms_credits integer;
BEGIN
-- Add SMS credits to purchased_sms_credits
UPDATE user_credits
SET purchased_sms_credits = COALESCE(purchased_sms_credits, 0) + p_sms_credits,
updated_at = now()
WHERE user_id = p_user_id;

-- Get new total SMS balance
SELECT get_total_sms_credits(p_user_id) INTO v_total_sms_credits;

-- Log to credit ledger
INSERT INTO credit_ledger (
user_id,
source,
amount,
balance_after,
sms_amount,
sms_balance_after,
stripe_session_id,
stripe_payment_intent_id,
metadata
)
VALUES (
p_user_id,
'credit_pack',
0, -- No image credits
(SELECT COALESCE(subscription_credits, 0) + COALESCE(purchased_credits, 0) + COALESCE(event_credits, 0) FROM user_credits WHERE user_id = p_user_id),
p_sms_credits,
v_total_sms_credits,
p_stripe_session_id,
p_stripe_payment_intent_id,
jsonb_build_object('expires', 'never', 'type', 'sms')
);

RETURN jsonb_build_object(
'success', true,
'sms_credits_added', p_sms_credits,
'new_sms_balance', v_total_sms_credits
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_create_concurrent_event(p_user_id uuid, p_event_id uuid DEFAULT NULL::uuid, p_event_source text DEFAULT 'subscription'::text)
 RETURNS TABLE(can_create boolean, current_count integer, limit_count integer, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_current_count integer;
v_limit integer;
v_role text;
BEGIN
-- Check if user is admin
SELECT role INTO v_role
FROM user_profiles
WHERE id = p_user_id;

IF v_role = 'admin' THEN
RETURN QUERY SELECT true, 0, 999999, NULL::text;
RETURN;
END IF;

-- Event pass events don't count toward subscription limits
IF p_event_source = 'event_pass' THEN
RETURN QUERY SELECT true, 0, 999999, NULL::text;
RETURN;
END IF;

-- Get current count and limit
v_current_count := count_user_active_events(p_user_id, p_event_id);
v_limit := get_user_concurrent_event_limit(p_user_id);

-- If no limit found (no active subscription), return error
IF v_limit IS NULL THEN
RETURN QUERY SELECT 
false,
v_current_count,
0,
'You need an active subscription to create events, or you can purchase an event pass for time-limited events.'::text;
RETURN;
END IF;

-- Check if under limit
IF v_current_count < v_limit THEN
RETURN QUERY SELECT 
true,
v_current_count,
v_limit,
NULL::text;
RETURN;
END IF;

-- At or over limit
RETURN QUERY SELECT 
false,
v_current_count,
v_limit,
format('You have reached your limit of %s concurrent active event%s. Please deactivate an existing event, upgrade your plan, or purchase an event pass for additional events.',
v_limit,
CASE WHEN v_limit = 1 THEN '' ELSE 's' END
)::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_create_event(p_user_id uuid)
 RETURNS TABLE(can_create boolean, reason text, subscription_type text, has_subscription boolean, has_event_pass boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_has_active_sub boolean;
v_available_passes_count integer;
v_subscription_status text;
v_tier_name text;
v_events_allowed integer;
v_current_event_count integer;
BEGIN
-- Get user's subscription info
SELECT up.subscription_status, st.name, COALESCE(st.events_allowed, 0)
INTO v_subscription_status, v_tier_name, v_events_allowed
FROM user_profiles up
LEFT JOIN subscription_tiers st ON up.subscription_tier_id = st.id
WHERE up.id = p_user_id;

-- Check for active subscription
v_has_active_sub := has_active_subscription(p_user_id);

-- Count available event passes
SELECT COUNT(*)
INTO v_available_passes_count
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.user_id = p_user_id
AND uep.activated_at IS NULL
AND ep.duration_hours IS NOT NULL;

-- Count current active events
SELECT COUNT(*)
INTO v_current_event_count
FROM events e
WHERE e.created_by = p_user_id
AND (e.end_datetime IS NULL OR e.end_datetime > NOW());

-- Check if user has active subscription
IF v_has_active_sub THEN
-- Check event limit for subscription
IF v_events_allowed = -1 OR v_current_event_count < v_events_allowed THEN
RETURN QUERY SELECT true, 'Active subscription allows event creation', 'subscription'::text, true, v_available_passes_count > 0;
ELSE
RETURN QUERY SELECT false, 'Event limit reached for subscription tier', 'subscription'::text, true, v_available_passes_count > 0;
END IF;
RETURN;
END IF;

-- Check if user has available event passes
IF v_available_passes_count > 0 THEN
RETURN QUERY SELECT true, 'Event pass available', 'event_pass'::text, false, true;
RETURN;
END IF;

-- User has neither subscription nor event pass
RETURN QUERY SELECT false, 'No active subscription or event pass', 'none'::text, false, false;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_modify_event_start_time(p_event_id uuid, p_user_id uuid)
 RETURNS TABLE(can_modify boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_is_admin boolean;
v_has_activated_pass boolean;
v_is_owner boolean;
BEGIN
-- Check if user is admin
v_is_admin := is_admin(p_user_id);

-- Admin can always modify
IF v_is_admin THEN
RETURN QUERY SELECT true, 'Admin override'::text;
RETURN;
END IF;

-- Check if user owns the event
SELECT EXISTS (
SELECT 1 FROM events
WHERE id = p_event_id
AND created_by = p_user_id
) INTO v_is_owner;

IF NOT v_is_owner THEN
RETURN QUERY SELECT false, 'Not event owner'::text;
RETURN;
END IF;

-- Check if event has an activated pass
v_has_activated_pass := has_activated_event_pass(p_event_id);

IF v_has_activated_pass THEN
RETURN QUERY SELECT 
false, 
'Cannot modify start time: Event pass has been activated and the duration countdown has begun. The start time is now locked.'::text;
RETURN;
END IF;

-- No activated pass, can modify
RETURN QUERY SELECT true, 'Can modify'::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_pass_validity(p_pass_id uuid, p_user_id uuid)
 RETURNS TABLE(is_valid boolean, is_expired boolean, expires_at timestamp with time zone, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_pass_user_id uuid;
v_activated_at timestamptz;
v_expires_at timestamptz;
v_is_active boolean;
BEGIN
-- Get pass details
SELECT 
uep.user_id,
uep.activated_at,
uep.expires_at,
uep.is_active
INTO v_pass_user_id, v_activated_at, v_expires_at, v_is_active
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.id = p_pass_id;

-- Check if pass exists
IF NOT FOUND THEN
RETURN QUERY SELECT false, false, NULL::timestamptz, 'Pass not found';
RETURN;
END IF;

-- Check if pass belongs to user
IF v_pass_user_id != p_user_id THEN
RETURN QUERY SELECT false, false, NULL::timestamptz, 'Pass does not belong to user';
RETURN;
END IF;

-- Check if pass is activated
IF v_activated_at IS NULL THEN
RETURN QUERY SELECT false, false, NULL::timestamptz, 'Pass is not activated';
RETURN;
END IF;

-- Check if pass is expired
IF v_expires_at < NOW() THEN
RETURN QUERY SELECT false, true, v_expires_at, 'Pass has expired';
RETURN;
END IF;

-- Pass is valid
RETURN QUERY SELECT true, false, v_expires_at, 'Pass is valid';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_credit(p_user_id uuid, p_amount integer DEFAULT 1)
 RETURNS TABLE(success boolean, consumed_from text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_purchased_credits integer;
v_subscription_credits integer;
v_amount_remaining integer;
v_consumed_from text := '';
BEGIN
-- Get current credits
SELECT 
COALESCE(user_credits.purchased_credits, 0),
COALESCE(user_credits.subscription_credits, 0)
INTO v_purchased_credits, v_subscription_credits
FROM user_credits
WHERE user_credits.user_id = p_user_id;

-- If no record found, create one with zero credits
IF NOT FOUND THEN
INSERT INTO user_credits (user_id, subscription_credits, purchased_credits, event_credits)
VALUES (p_user_id, 0, 0, 0);

RETURN QUERY SELECT false, 'insufficient_credits'::text;
RETURN;
END IF;

-- Check if user has enough total credits
IF (v_purchased_credits + v_subscription_credits) < p_amount THEN
RETURN QUERY SELECT false, 'insufficient_credits'::text;
RETURN;
END IF;

v_amount_remaining := p_amount;

-- First, consume from purchased_credits
IF v_purchased_credits > 0 THEN
IF v_purchased_credits >= v_amount_remaining THEN
-- All from purchased credits
UPDATE user_credits
SET purchased_credits = purchased_credits - v_amount_remaining
WHERE user_id = p_user_id;

v_consumed_from := 'purchased';
RETURN QUERY SELECT true, v_consumed_from;
RETURN;
ELSE
-- Consume all purchased credits and continue
v_amount_remaining := v_amount_remaining - v_purchased_credits;

UPDATE user_credits
SET purchased_credits = 0
WHERE user_id = p_user_id;

v_consumed_from := 'purchased+subscription';
END IF;
END IF;

-- Then consume from subscription_credits
IF v_amount_remaining > 0 THEN
UPDATE user_credits
SET subscription_credits = subscription_credits - v_amount_remaining
WHERE user_id = p_user_id;

IF v_consumed_from = '' THEN
v_consumed_from := 'subscription';
END IF;
END IF;

RETURN QUERY SELECT true, v_consumed_from;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_sms_credit(p_user_id uuid, p_amount integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_subscription_sms_credits integer;
v_purchased_sms_credits integer;
v_event_sms_credits integer;
v_total_sms_credits integer;
v_consumed_from text;
v_balance_after integer;
BEGIN
-- Lock the row for update
SELECT
COALESCE(subscription_sms_credits, 0),
COALESCE(purchased_sms_credits, 0),
COALESCE(event_sms_credits, 0)
INTO v_subscription_sms_credits, v_purchased_sms_credits, v_event_sms_credits
FROM user_credits
WHERE user_id = p_user_id
FOR UPDATE;

v_total_sms_credits := v_subscription_sms_credits + v_purchased_sms_credits + v_event_sms_credits;

IF v_total_sms_credits < p_amount THEN
RETURN jsonb_build_object(
'success', false,
'error', 'Insufficient SMS credits',
'available', v_total_sms_credits
);
END IF;

-- Consume from subscription first
IF v_subscription_sms_credits >= p_amount THEN
UPDATE user_credits
SET subscription_sms_credits = subscription_sms_credits - p_amount,
sms_used = sms_used + p_amount,
updated_at = now()
WHERE user_id = p_user_id;

v_consumed_from := 'subscription';
v_balance_after := v_total_sms_credits - p_amount;

-- Then from purchased credits
ELSIF v_subscription_sms_credits + v_purchased_sms_credits >= p_amount THEN
DECLARE
v_remaining integer := p_amount - v_subscription_sms_credits;
BEGIN
UPDATE user_credits
SET subscription_sms_credits = 0,
purchased_sms_credits = purchased_sms_credits - v_remaining,
sms_used = sms_used + p_amount,
updated_at = now()
WHERE user_id = p_user_id;

v_consumed_from := 'purchased';
v_balance_after := v_total_sms_credits - p_amount;
END;

-- Finally from event credits
ELSE
DECLARE
v_remaining integer := p_amount - v_subscription_sms_credits - v_purchased_sms_credits;
BEGIN
UPDATE user_credits
SET subscription_sms_credits = 0,
purchased_sms_credits = 0,
event_sms_credits = event_sms_credits - v_remaining,
sms_used = sms_used + p_amount,
updated_at = now()
WHERE user_id = p_user_id;

v_consumed_from := 'event';
v_balance_after := v_total_sms_credits - p_amount;
END;
END IF;

-- Log to credit ledger
INSERT INTO credit_ledger (user_id, source, amount, balance_after, sms_amount, sms_balance_after, metadata)
VALUES (
p_user_id,
'consumption',
0, -- No image credits consumed
(SELECT COALESCE(subscription_credits, 0) + COALESCE(purchased_credits, 0) + COALESCE(event_credits, 0) FROM user_credits WHERE user_id = p_user_id),
-p_amount,
v_balance_after,
jsonb_build_object('consumed_from', v_consumed_from, 'type', 'sms')
);

RETURN jsonb_build_object(
'success', true,
'consumed_from', v_consumed_from,
'amount', p_amount,
'balance_after', v_balance_after
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.count_user_active_events(p_user_id uuid, p_exclude_event_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_count integer;
BEGIN
-- Count events that are:
-- 1. Created by this user
-- 2. Is active
-- 3. From subscription (not event pass)
-- 4. Either has no time limits OR is currently within time window
SELECT COUNT(*)
INTO v_count
FROM events e
WHERE e.user_id = p_user_id
AND e.is_active = true
AND e.event_source = 'subscription'
AND (e.id != p_exclude_event_id OR p_exclude_event_id IS NULL)
AND (
-- No time limits (always active)
(e.start_datetime IS NULL AND e.end_datetime IS NULL)
OR
-- Within time window
(e.start_datetime IS NOT NULL AND e.end_datetime IS NOT NULL 
AND NOW() >= e.start_datetime AND NOW() <= e.end_datetime)
OR
-- Started but no end time
(e.start_datetime IS NOT NULL AND e.end_datetime IS NULL 
AND NOW() >= e.start_datetime)
);

RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.deactivate_expired_pass_events()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_count integer;
BEGIN
-- Deactivate events whose pass has expired
WITH expired_passes AS (
SELECT 
uep.event_id,
uep.activated_at + (ep.duration_hours || ' hours')::interval as expires_at
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.activated_at IS NOT NULL
AND uep.event_id IS NOT NULL
AND NOW() > (uep.activated_at + (ep.duration_hours || ' hours')::interval)
)
UPDATE events
SET is_active = false
FROM expired_passes
WHERE events.id = expired_passes.event_id
AND events.is_active = true;

GET DIAGNOSTICS v_count = ROW_COUNT;
RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.duplicate_prompt(source_prompt_id uuid, new_owner_id uuid DEFAULT auth.uid())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
new_prompt_id uuid;
source_prompt record;
BEGIN
-- Validate the source prompt exists and is public
SELECT * INTO source_prompt
FROM prompts
WHERE id = source_prompt_id
AND is_active = true;

IF NOT FOUND THEN
RAISE EXCEPTION 'Source prompt not found or is inactive';
END IF;

-- Only public prompts can be duplicated by others
IF source_prompt.is_public = false AND source_prompt.user_id != new_owner_id THEN
RAISE EXCEPTION 'Cannot duplicate private prompts that you do not own';
END IF;

-- Create the duplicate prompt
INSERT INTO prompts (
user_id,
name,
description,
category,
prompt_text,
preview_image_url,
reference_image_url,
tags,
is_active,
is_public,
source_prompt_id,
usage_count
)
VALUES (
new_owner_id,
source_prompt.name || ' (Copy)',
source_prompt.description,
source_prompt.category,
source_prompt.prompt_text,
source_prompt.preview_image_url,
source_prompt.reference_image_url,
source_prompt.tags,
true,
false, -- Duplicates default to private
source_prompt_id, -- Track the source
0 -- Reset usage count
)
RETURNING id INTO new_prompt_id;

RETURN new_prompt_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_concurrent_event_limit(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_limit integer;
v_role text;
BEGIN
-- Check if user is admin - admins have no limits
SELECT role INTO v_role
FROM user_profiles
WHERE id = p_user_id;

IF v_role = 'admin' THEN
RETURN 999999; -- Effectively unlimited
END IF;

-- First check new user_subscriptions table
SELECT st.concurrent_events
INTO v_limit
FROM user_subscriptions us
JOIN subscription_tiers_new st ON us.tier_id = st.id
WHERE us.user_id = p_user_id
AND us.status = 'active'
AND us.current_period_end > NOW()
ORDER BY us.created_at DESC
LIMIT 1;

-- If found in new table, return it
IF v_limit IS NOT NULL THEN
RETURN v_limit;
END IF;

-- Fallback to old user_profiles table
SELECT st.concurrent_events
INTO v_limit
FROM user_profiles up
JOIN subscription_tiers_new st ON up.subscription_tier_id = st.id
WHERE up.id = p_user_id
AND up.subscription_status = 'active';

-- Return limit or NULL if no active subscription
RETURN v_limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_credit_balance(p_user_id uuid)
 RETURNS TABLE(subscription_credits integer, purchased_credits integer, event_credits integer, image_credits integer, total_credits integer, subscription_sms_credits integer, purchased_sms_credits integer, event_sms_credits integer, total_sms_credits integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
v_subscription_credits integer;
v_purchased_credits integer;
v_event_credits integer;
v_subscription_sms_credits integer;
v_purchased_sms_credits integer;
v_event_sms_credits integer;
BEGIN
-- Fetch credit data
SELECT
COALESCE(user_credits.subscription_credits, 0),
COALESCE(user_credits.purchased_credits, 0),
COALESCE(user_credits.event_credits, 0),
COALESCE(user_credits.subscription_sms_credits, 0),
COALESCE(user_credits.purchased_sms_credits, 0),
COALESCE(user_credits.event_sms_credits, 0)
INTO
v_subscription_credits,
v_purchased_credits,
v_event_credits,
v_subscription_sms_credits,
v_purchased_sms_credits,
v_event_sms_credits
FROM user_credits
WHERE user_credits.user_id = p_user_id;

-- If no record found, return zeros
IF NOT FOUND THEN
v_subscription_credits := 0;
v_purchased_credits := 0;
v_event_credits := 0;
v_subscription_sms_credits := 0;
v_purchased_sms_credits := 0;
v_event_sms_credits := 0;
END IF;

-- Return the data with event_credits included in image_credits
RETURN QUERY SELECT
v_subscription_credits,
v_purchased_credits,
v_event_credits,
v_subscription_credits + v_purchased_credits + v_event_credits AS image_credits,
v_subscription_credits + v_purchased_credits + v_event_credits AS total_credits,
v_subscription_sms_credits,
v_purchased_sms_credits,
v_event_sms_credits,
v_subscription_sms_credits + v_purchased_sms_credits + v_event_sms_credits AS total_sms_credits;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_subscription_info(p_user_id uuid)
 RETURNS TABLE(subscription_type text, tier_name text, has_active_subscription boolean, has_available_passes boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_has_active_sub boolean;
v_available_passes_count integer;
v_subscription_status text;
v_tier_name text;
BEGIN
-- Get user's subscription info
SELECT up.subscription_status, st.name
INTO v_subscription_status, v_tier_name
FROM user_profiles up
LEFT JOIN subscription_tiers st ON up.subscription_tier_id = st.id
WHERE up.id = p_user_id;

-- Check for active subscription
v_has_active_sub := has_active_subscription(p_user_id);

-- Count available event passes
SELECT COUNT(*)
INTO v_available_passes_count
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.user_id = p_user_id
AND uep.activated_at IS NULL
AND ep.duration_hours IS NOT NULL;

-- Determine subscription type
IF v_has_active_sub THEN
RETURN QUERY SELECT 
'subscription'::text,
v_tier_name,
true,
v_available_passes_count > 0;
ELSIF v_available_passes_count > 0 THEN
RETURN QUERY SELECT 
'event_pass'::text,
v_tier_name,
false,
true;
ELSE
RETURN QUERY SELECT 
'none'::text,
v_tier_name,
false,
false;
END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_subscription_type(p_user_id uuid)
 RETURNS TABLE(subscription_type text, tier_name text, has_active_sub boolean, has_available_passes boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_has_active_sub boolean;
v_tier_name text;
v_subscription_status text;
v_available_passes_count integer;
BEGIN
-- Get subscription info
SELECT 
up.subscription_status,
st.name
INTO v_subscription_status, v_tier_name
FROM user_profiles up
LEFT JOIN subscription_tiers_new st ON up.subscription_tier_id = st.id
WHERE up.id = p_user_id;

-- Check for active subscription
v_has_active_sub := has_active_subscription(p_user_id);

-- Count available event passes - FIXED: Join with event_passes instead of subscription_tiers
SELECT COUNT(*)
INTO v_available_passes_count
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.user_id = p_user_id
AND uep.activated_at IS NULL
AND ep.duration_hours IS NOT NULL;

-- Determine subscription type
IF v_has_active_sub THEN
RETURN QUERY SELECT 
'subscription'::text,
v_tier_name,
true,
v_available_passes_count > 0;
ELSIF v_available_passes_count > 0 THEN
RETURN QUERY SELECT 
'event_pass'::text,
v_tier_name,
false,
true;
ELSE
RETURN QUERY SELECT 
'free'::text,
COALESCE(v_tier_name, 'Free'),
false,
false;
END IF;
END;
$function$
;

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

-- If no Free tier found, raise error
IF v_free_tier_id IS NULL THEN
RAISE EXCEPTION 'No active Free tier found';
END IF;

-- Extract full_name from metadata or use email username as fallback
v_full_name := COALESCE(
NEW.raw_user_meta_data->>'full_name',
split_part(NEW.email, '@', 1)
);

-- Insert user profile with full_name
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

-- Insert user credits with both OLD and NEW system columns
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
10,  -- images_limit (old system)
10,  -- sms_limit
1,   -- events_limit
0,   -- images_used
0,   -- sms_used
10,  -- subscription_credits (new system)
10,  -- subscription_sms_credits (new system)
0,   -- purchased_credits
0,   -- purchased_sms_credits
0,   -- event_credits
0,   -- event_sms_credits
date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month'
)
ON CONFLICT (user_id) DO NOTHING;

-- Calculate initial balance
v_credit_balance := 10; -- subscription_credits

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

-- Create ledger entry for initial SMS credits (tracked separately)
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
'credit_type', 'sms',
'description', 'Initial FREE tier SMS credits'
),
now()
);

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_new_subscription_count integer;
v_old_subscription_active boolean;
BEGIN
-- Check new user_subscriptions table first
SELECT COUNT(*)
INTO v_new_subscription_count
FROM user_subscriptions us
JOIN subscription_tiers_new st ON us.tier_id = st.id
WHERE us.user_id = p_user_id
AND us.status IN ('active', 'past_due')
AND st.is_active = true;

IF v_new_subscription_count > 0 THEN
RETURN true;
END IF;

-- Check old user_profiles subscription fields for backward compatibility
SELECT 
CASE 
WHEN subscription_tier_id IS NOT NULL 
AND LOWER(subscription_status) IN ('active', 'past_due')
THEN true
ELSE false
END
INTO v_old_subscription_active
FROM user_profiles
WHERE id = p_user_id;

RETURN COALESCE(v_old_subscription_active, false);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_image_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
-- Only increment if user_id is set
IF NEW.user_id IS NOT NULL THEN
-- Increment user image usage (ignore if user_credits doesn't exist yet)
UPDATE user_credits 
SET images_used = images_used + 1,
updated_at = now()
WHERE user_id = NEW.user_id;
END IF;

-- Increment event total
UPDATE events 
SET total_generations = total_generations + 1,
updated_at = now()
WHERE id = NEW.event_id;

-- Increment prompt usage
UPDATE prompts 
SET usage_count = usage_count + 1,
updated_at = now()
WHERE id = NEW.prompt_id;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_sms_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
-- Only increment if user_id is set
IF NEW.user_id IS NOT NULL THEN
-- Increment user SMS usage (ignore if user_credits doesn't exist yet)
UPDATE user_credits 
SET sms_used = sms_used + 1,
updated_at = now()
WHERE user_id = NEW.user_id;
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_event_active_and_valid(event_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
event_record RECORD;
BEGIN
-- Query with SECURITY DEFINER bypasses RLS
SELECT 
is_active,
start_datetime,
end_datetime
INTO event_record
FROM events
WHERE id = event_id;

-- If event not found, return false
IF NOT FOUND THEN
RETURN false;
END IF;

-- Check if event is active
IF event_record.is_active = false THEN
RETURN false;
END IF;

-- Check datetime restrictions if they exist
IF event_record.start_datetime IS NOT NULL 
AND NOW() < event_record.start_datetime THEN
RETURN false;
END IF;

IF event_record.end_datetime IS NOT NULL 
AND NOW() > event_record.end_datetime THEN
RETURN false;
END IF;

-- Event is active and within valid time window
RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_start_time_change_with_activated_pass()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_has_activated_pass boolean;
v_is_admin boolean;
v_start_time_changed boolean;
BEGIN
-- Only check on UPDATE operations
IF TG_OP = 'UPDATE' THEN
-- Check if start_datetime is being changed
v_start_time_changed := (OLD.start_datetime IS DISTINCT FROM NEW.start_datetime);

-- If start time hasn't changed, allow the update
IF NOT v_start_time_changed THEN
RETURN NEW;
END IF;

-- Check if user is admin (using auth.uid())
v_is_admin := is_admin(auth.uid());

-- Admin can bypass
IF v_is_admin THEN
RETURN NEW;
END IF;

-- Check if event has activated pass
v_has_activated_pass := has_activated_event_pass(OLD.id);

IF v_has_activated_pass THEN
RAISE EXCEPTION 'Cannot modify start time: Event pass has been activated. The start time is now locked.';
END IF;
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_event_time_restrictions(p_user_id uuid, p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_pass_id uuid, p_event_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(is_valid boolean, error_message text, restriction_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_user_role text;
v_has_active_sub boolean;
v_has_available_passes boolean;
v_subscription_type text;
v_can_create boolean;
v_current_count integer;
v_limit_count integer;
v_limit_error text;
v_event_source text;
BEGIN
-- Case 0: Check if user is ADMIN - bypass all restrictions
SELECT LOWER(role)
INTO v_user_role
FROM user_profiles
WHERE id = p_user_id;

IF v_user_role = 'admin' THEN
RETURN QUERY SELECT
true,
NULL::text,
'admin_unlimited'::text;
RETURN;
END IF;

-- Determine event source
IF p_pass_id IS NOT NULL THEN
v_event_source := 'event_pass';
ELSE
v_event_source := 'subscription';
END IF;

-- Check concurrent event limits for subscription events
IF v_event_source = 'subscription' THEN
-- FIX: Use explicit aliases to avoid ambiguous column references
SELECT 
c.can_create, 
c.current_count, 
c.limit_count, 
c.error_message
INTO v_can_create, v_current_count, v_limit_count, v_limit_error
FROM can_create_concurrent_event(p_user_id, p_event_id, v_event_source) c;

IF NOT v_can_create THEN
RETURN QUERY SELECT 
false,
v_limit_error,
'concurrent_limit_reached'::text;
RETURN;
END IF;
END IF;

-- Get user subscription type
SELECT 
subscription_type,
has_active_sub,
has_available_passes
INTO v_subscription_type, v_has_active_sub, v_has_available_passes
FROM get_user_subscription_type(p_user_id);

-- Case 1: User has active subscription
IF v_has_active_sub THEN
-- Subscription users should NOT use event passes
IF p_pass_id IS NOT NULL THEN
RETURN QUERY SELECT 
false,
'You have an active subscription. Event passes are not needed for subscription accounts.'::text,
'subscription_no_pass'::text;
RETURN;
END IF;

-- Subscription users can have unlimited events (no time restrictions required)
RETURN QUERY SELECT 
true,
NULL::text,
'subscription_unlimited'::text;
RETURN;
END IF;

-- Case 2: User wants to use event pass
IF p_pass_id IS NOT NULL THEN
-- Verify pass exists and belongs to user
IF NOT EXISTS (
SELECT 1 FROM user_event_passes
WHERE id = p_pass_id
AND user_id = p_user_id
AND activated_at IS NULL
) THEN
RETURN QUERY SELECT 
false,
'Selected event pass is invalid or already activated.'::text,
'invalid_pass'::text;
RETURN;
END IF;

-- Event pass events MUST have time restrictions
IF p_start_datetime IS NULL OR p_end_datetime IS NULL THEN
RETURN QUERY SELECT 
false,
'Event pass events must have start and end times specified.'::text,
'pass_requires_times'::text;
RETURN;
END IF;

-- Validate end time is after start time
IF p_end_datetime <= p_start_datetime THEN
RETURN QUERY SELECT 
false,
'Event end time must be after start time.'::text,
'invalid_time_range'::text;
RETURN;
END IF;

-- Event pass events are valid
RETURN QUERY SELECT 
true,
NULL::text,
'event_pass_valid'::text;
RETURN;
END IF;

-- Case 3: Free tier user without passes trying to create event
RETURN QUERY SELECT 
false,
'You need an active subscription or event pass to create events.'::text,
'no_subscription_or_pass'::text;
END;
$function$
;

grant delete on table "public"."stripe_customers" to "ryanrobertlee@gmail.com";

grant insert on table "public"."stripe_customers" to "ryanrobertlee@gmail.com";

grant select on table "public"."stripe_customers" to "ryanrobertlee@gmail.com";

grant update on table "public"."stripe_customers" to "ryanrobertlee@gmail.com";


  create policy "Anyone can view active add-ons"
  on "public"."add_ons"
  as permissive
  for select
  to anon, authenticated
using (((is_active = true) OR ( SELECT public.user_is_admin() AS user_is_admin)));



  create policy "Anyone can view active topup products"
  on "public"."credit_topup_products"
  as permissive
  for select
  to anon, authenticated
using (((is_active = true) OR ( SELECT public.user_is_admin() AS user_is_admin)));



  create policy "Anyone can view active passes"
  on "public"."event_passes"
  as permissive
  for select
  to anon, authenticated
using (((is_active = true) OR ( SELECT public.user_is_admin() AS user_is_admin)));



  create policy "Anyone can read global settings"
  on "public"."global_settings"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Anyone can view active tiers"
  on "public"."subscription_tiers"
  as permissive
  for select
  to anon, authenticated
using (((is_active = true) OR ( SELECT public.user_is_admin() AS user_is_admin)));



  create policy "Authenticated users can delete prompt images"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'prompt-images'::text));



  create policy "Authenticated users can update prompt images"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'prompt-images'::text))
with check ((bucket_id = 'prompt-images'::text));



  create policy "Authenticated users can upload prompt images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'prompt-images'::text));



  create policy "Profile pictures are publicly accessible"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'profile-pictures'::text));



  create policy "Public read access for prompt images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'prompt-images'::text));



  create policy "Users can delete own profile picture"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'profile-pictures'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can update own profile picture"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'profile-pictures'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can upload own profile picture"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'profile-pictures'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



