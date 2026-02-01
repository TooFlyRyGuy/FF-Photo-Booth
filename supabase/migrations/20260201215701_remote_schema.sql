


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."stripe_order_status" AS ENUM (
    'pending',
    'completed',
    'canceled'
);


ALTER TYPE "public"."stripe_order_status" OWNER TO "postgres";


CREATE TYPE "public"."stripe_subscription_status" AS ENUM (
    'not_started',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
);


ALTER TYPE "public"."stripe_subscription_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."activate_pass"("p_pass_id" "uuid", "p_event_id" "uuid", "p_user_id" "uuid") RETURNS TABLE("success" boolean, "expires_at" timestamp with time zone, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_duration_hours integer;
v_pass_user_id uuid;
v_expiration timestamptz;
BEGIN
SELECT 
uep.user_id,
ep.duration_hours
INTO v_pass_user_id, v_duration_hours
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.id = p_pass_id;

IF NOT FOUND THEN
RETURN QUERY SELECT false, NULL::timestamptz, 'Pass not found';
RETURN;
END IF;

IF v_pass_user_id != p_user_id THEN
RETURN QUERY SELECT false, NULL::timestamptz, 'Pass does not belong to user';
RETURN;
END IF;

IF v_duration_hours IS NULL THEN
RETURN QUERY SELECT false, NULL::timestamptz, 'Pass does not have duration';
RETURN;
END IF;

v_expiration := NOW() + (v_duration_hours || ' hours')::interval;

UPDATE user_event_passes
SET 
activated_at = NOW(),
event_id = p_event_id,
expires_at = v_expiration,
is_active = true
WHERE id = p_pass_id
AND activated_at IS NULL;

IF NOT FOUND THEN
RETURN QUERY SELECT false, NULL::timestamptz, 'Pass already activated';
RETURN;
END IF;

RETURN QUERY SELECT true, v_expiration, 'Pass activated successfully';
END;
$$;


ALTER FUNCTION "public"."activate_pass"("p_pass_id" "uuid", "p_event_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_event_pass_credits"("p_user_id" "uuid", "p_credits" integer, "p_pass_id" "uuid", "p_stripe_payment_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
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
$$;


ALTER FUNCTION "public"."add_event_pass_credits"("p_user_id" "uuid", "p_credits" integer, "p_pass_id" "uuid", "p_stripe_payment_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_event_pass_sms_credits"("p_user_id" "uuid", "p_sms_credits" integer, "p_pass_id" "uuid", "p_stripe_payment_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
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
$$;


ALTER FUNCTION "public"."add_event_pass_sms_credits"("p_user_id" "uuid", "p_sms_credits" integer, "p_pass_id" "uuid", "p_stripe_payment_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_purchased_credits"("p_user_id" "uuid", "p_credits" integer, "p_stripe_session_id" "text" DEFAULT NULL::"text", "p_stripe_payment_intent_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_total_credits integer;
BEGIN
UPDATE user_credits
SET purchased_credits = COALESCE(purchased_credits, 0) + p_credits,
updated_at = now()
WHERE user_id = p_user_id;

SELECT get_total_credits(p_user_id) INTO v_total_credits;

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
$$;


ALTER FUNCTION "public"."add_purchased_credits"("p_user_id" "uuid", "p_credits" integer, "p_stripe_session_id" "text", "p_stripe_payment_intent_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_purchased_sms_credits"("p_user_id" "uuid", "p_sms_credits" integer, "p_stripe_session_id" "text" DEFAULT NULL::"text", "p_stripe_payment_intent_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_total_sms_credits integer;
BEGIN
UPDATE user_credits
SET purchased_sms_credits = COALESCE(purchased_sms_credits, 0) + p_sms_credits,
updated_at = now()
WHERE user_id = p_user_id;

SELECT get_total_sms_credits(p_user_id) INTO v_total_sms_credits;

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
$$;


ALTER FUNCTION "public"."add_purchased_sms_credits"("p_user_id" "uuid", "p_sms_credits" integer, "p_stripe_session_id" "text", "p_stripe_payment_intent_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_create_concurrent_event"("p_user_id" "uuid", "p_event_id" "uuid" DEFAULT NULL::"uuid", "p_event_source" "text" DEFAULT 'subscription'::"text") RETURNS TABLE("can_create" boolean, "current_count" integer, "limit_count" integer, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_current_count integer;
v_limit integer;
v_role text;
BEGIN
SELECT role INTO v_role
FROM user_profiles
WHERE id = p_user_id;

IF v_role = 'admin' THEN
RETURN QUERY SELECT true, 0, 999999, NULL::text;
RETURN;
END IF;

IF p_event_source = 'event_pass' THEN
RETURN QUERY SELECT true, 0, 999999, NULL::text;
RETURN;
END IF;

v_current_count := count_user_active_events(p_user_id, p_event_id);
v_limit := get_user_concurrent_event_limit(p_user_id);

IF v_limit IS NULL THEN
RETURN QUERY SELECT 
false,
v_current_count,
0,
'You need an active subscription to create events, or you can purchase an event pass for time-limited events.'::text;
RETURN;
END IF;

IF v_current_count < v_limit THEN
RETURN QUERY SELECT 
true,
v_current_count,
v_limit,
NULL::text;
RETURN;
END IF;

RETURN QUERY SELECT 
false,
v_current_count,
v_limit,
format('You have reached your limit of %s concurrent active event%s. Please deactivate an existing event, upgrade your plan, or purchase an event pass for additional events.',
v_limit,
CASE WHEN v_limit = 1 THEN '' ELSE 's' END
)::text;
END;
$$;


ALTER FUNCTION "public"."can_create_concurrent_event"("p_user_id" "uuid", "p_event_id" "uuid", "p_event_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_create_event"("p_user_id" "uuid") RETURNS TABLE("can_create" boolean, "reason" "text", "subscription_type" "text", "has_subscription" boolean, "has_event_pass" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_has_active_sub boolean;
v_available_passes_count integer;
v_subscription_status text;
v_tier_name text;
v_events_allowed integer;
v_current_event_count integer;
BEGIN
SELECT up.subscription_status, st.name, COALESCE(st.events_allowed, 0)
INTO v_subscription_status, v_tier_name, v_events_allowed
FROM user_profiles up
LEFT JOIN subscription_tiers st ON up.subscription_tier_id = st.id
WHERE up.id = p_user_id;

v_has_active_sub := has_active_subscription(p_user_id);

SELECT COUNT(*)
INTO v_available_passes_count
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.user_id = p_user_id
AND uep.activated_at IS NULL
AND ep.duration_hours IS NOT NULL;

SELECT COUNT(*)
INTO v_current_event_count
FROM events e
WHERE e.created_by = p_user_id
AND (e.end_datetime IS NULL OR e.end_datetime > NOW());

IF v_has_active_sub THEN
IF v_events_allowed = -1 OR v_current_event_count < v_events_allowed THEN
RETURN QUERY SELECT true, 'Active subscription allows event creation', 'subscription'::text, true, v_available_passes_count > 0;
ELSE
RETURN QUERY SELECT false, 'Event limit reached for subscription tier', 'subscription'::text, true, v_available_passes_count > 0;
END IF;
RETURN;
END IF;

IF v_available_passes_count > 0 THEN
RETURN QUERY SELECT true, 'Event pass available', 'event_pass'::text, false, true;
RETURN;
END IF;

RETURN QUERY SELECT false, 'No active subscription or event pass', 'none'::text, false, false;
END;
$$;


ALTER FUNCTION "public"."can_create_event"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_modify_event_start_time"("p_event_id" "uuid", "p_user_id" "uuid") RETURNS TABLE("can_modify" boolean, "reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_is_admin boolean;
v_has_activated_pass boolean;
v_is_owner boolean;
BEGIN
v_is_admin := is_admin(p_user_id);

IF v_is_admin THEN
RETURN QUERY SELECT true, 'Admin override'::text;
RETURN;
END IF;

SELECT EXISTS (
SELECT 1 FROM events
WHERE id = p_event_id
AND created_by = p_user_id
) INTO v_is_owner;

IF NOT v_is_owner THEN
RETURN QUERY SELECT false, 'Not event owner'::text;
RETURN;
END IF;

v_has_activated_pass := has_activated_event_pass(p_event_id);

IF v_has_activated_pass THEN
RETURN QUERY SELECT 
false, 
'Cannot modify start time: Event pass has been activated and the duration countdown has begun. The start time is now locked.'::text;
RETURN;
END IF;

RETURN QUERY SELECT true, 'Can modify'::text;
END;
$$;


ALTER FUNCTION "public"."can_modify_event_start_time"("p_event_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_modify_event_start_time"("p_event_id" "uuid", "p_user_id" "uuid") IS 'Validates if a user can modify an event start time. Returns false if event has an activated pass (except for admins).';



CREATE OR REPLACE FUNCTION "public"."check_pass_validity"("p_pass_id" "uuid", "p_user_id" "uuid") RETURNS TABLE("is_valid" boolean, "is_expired" boolean, "expires_at" timestamp with time zone, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_pass_user_id uuid;
v_activated_at timestamptz;
v_expires_at timestamptz;
v_is_active boolean;
BEGIN
SELECT 
uep.user_id,
uep.activated_at,
uep.expires_at,
uep.is_active
INTO v_pass_user_id, v_activated_at, v_expires_at, v_is_active
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.id = p_pass_id;

IF NOT FOUND THEN
RETURN QUERY SELECT false, false, NULL::timestamptz, 'Pass not found';
RETURN;
END IF;

IF v_pass_user_id != p_user_id THEN
RETURN QUERY SELECT false, false, NULL::timestamptz, 'Pass does not belong to user';
RETURN;
END IF;

IF v_activated_at IS NULL THEN
RETURN QUERY SELECT false, false, NULL::timestamptz, 'Pass is not activated';
RETURN;
END IF;

IF v_expires_at < NOW() THEN
RETURN QUERY SELECT false, true, v_expires_at, 'Pass has expired';
RETURN;
END IF;

RETURN QUERY SELECT true, false, v_expires_at, 'Pass is valid';
END;
$$;


ALTER FUNCTION "public"."check_pass_validity"("p_pass_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_credit"("p_user_id" "uuid", "p_amount" integer DEFAULT 1) RETURNS TABLE("success" boolean, "consumed_from" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_purchased_credits integer;
v_subscription_credits integer;
v_amount_remaining integer;
v_consumed_from text := '';
BEGIN
SELECT 
COALESCE(user_credits.purchased_credits, 0),
COALESCE(user_credits.subscription_credits, 0)
INTO v_purchased_credits, v_subscription_credits
FROM user_credits
WHERE user_credits.user_id = p_user_id;

IF NOT FOUND THEN
INSERT INTO user_credits (user_id, subscription_credits, purchased_credits, event_credits)
VALUES (p_user_id, 0, 0, 0);

RETURN QUERY SELECT false, 'insufficient_credits'::text;
RETURN;
END IF;

IF (v_purchased_credits + v_subscription_credits) < p_amount THEN
RETURN QUERY SELECT false, 'insufficient_credits'::text;
RETURN;
END IF;

v_amount_remaining := p_amount;

IF v_purchased_credits > 0 THEN
IF v_purchased_credits >= v_amount_remaining THEN
UPDATE user_credits
SET purchased_credits = purchased_credits - v_amount_remaining
WHERE user_id = p_user_id;

v_consumed_from := 'purchased';
RETURN QUERY SELECT true, v_consumed_from;
RETURN;
ELSE
v_amount_remaining := v_amount_remaining - v_purchased_credits;

UPDATE user_credits
SET purchased_credits = 0
WHERE user_id = p_user_id;

v_consumed_from := 'purchased+subscription';
END IF;
END IF;

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
$$;


ALTER FUNCTION "public"."consume_credit"("p_user_id" "uuid", "p_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_sms_credit"("p_user_id" "uuid", "p_amount" integer DEFAULT 1) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_subscription_sms_credits integer;
v_purchased_sms_credits integer;
v_event_sms_credits integer;
v_total_sms_credits integer;
v_consumed_from text;
v_balance_after integer;
BEGIN
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

IF v_subscription_sms_credits >= p_amount THEN
UPDATE user_credits
SET subscription_sms_credits = subscription_sms_credits - p_amount,
sms_used = sms_used + p_amount,
updated_at = now()
WHERE user_id = p_user_id;

v_consumed_from := 'subscription';
v_balance_after := v_total_sms_credits - p_amount;

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
$$;


ALTER FUNCTION "public"."consume_sms_credit"("p_user_id" "uuid", "p_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_user_active_events"("p_user_id" "uuid", "p_exclude_event_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_count integer;
BEGIN
SELECT COUNT(*)
INTO v_count
FROM events e
WHERE e.user_id = p_user_id
AND e.is_active = true
AND e.event_source = 'subscription'
AND (e.id != p_exclude_event_id OR p_exclude_event_id IS NULL)
AND (
(e.start_datetime IS NULL AND e.end_datetime IS NULL)
OR
(e.start_datetime IS NOT NULL AND e.end_datetime IS NOT NULL 
AND NOW() >= e.start_datetime AND NOW() <= e.end_datetime)
OR
(e.start_datetime IS NOT NULL AND e.end_datetime IS NULL 
AND NOW() >= e.start_datetime)
);

RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."count_user_active_events"("p_user_id" "uuid", "p_exclude_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deactivate_expired_pass_events"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_count integer;
BEGIN
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
$$;


ALTER FUNCTION "public"."deactivate_expired_pass_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."duplicate_prompt"("source_prompt_id" "uuid", "new_owner_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
new_prompt_id uuid;
source_prompt record;
BEGIN
SELECT * INTO source_prompt
FROM prompts
WHERE id = source_prompt_id
AND is_active = true;

IF NOT FOUND THEN
RAISE EXCEPTION 'Source prompt not found or is inactive';
END IF;

IF source_prompt.is_public = false AND source_prompt.user_id != new_owner_id THEN
RAISE EXCEPTION 'Cannot duplicate private prompts that you do not own';
END IF;

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
$$;


ALTER FUNCTION "public"."duplicate_prompt"("source_prompt_id" "uuid", "new_owner_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."duplicate_prompt"("source_prompt_id" "uuid", "new_owner_id" "uuid") IS 'Duplicates a public prompt, creating a new prompt owned by the calling user';



CREATE OR REPLACE FUNCTION "public"."get_available_passes"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "tier_name" "text", "duration_hours" integer, "purchased_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
RETURN QUERY
SELECT 
uep.id,
ep.name as tier_name,
ep.duration_hours,
uep.created_at as purchased_at
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.user_id = p_user_id
AND uep.activated_at IS NULL
AND ep.duration_hours IS NOT NULL
ORDER BY uep.created_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_available_passes"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pass_expiration"("p_pass_id" "uuid") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_activated_at timestamptz;
v_duration_hours integer;
BEGIN
SELECT 
uep.activated_at,
ep.duration_hours
INTO v_activated_at, v_duration_hours
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.id = p_pass_id;

IF NOT FOUND OR v_activated_at IS NULL THEN
RETURN NULL;
END IF;

RETURN v_activated_at + (v_duration_hours || ' hours')::interval;
END;
$$;


ALTER FUNCTION "public"."get_pass_expiration"("p_pass_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_credits"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_subscription_credits integer;
v_purchased_credits integer;
v_event_credits integer;
BEGIN
SELECT 
COALESCE(subscription_credits, 0),
COALESCE(purchased_credits, 0),
COALESCE(event_credits, 0)
INTO v_subscription_credits, v_purchased_credits, v_event_credits
FROM user_credits
WHERE user_id = p_user_id;

RETURN v_subscription_credits + v_purchased_credits + v_event_credits;
END;
$$;


ALTER FUNCTION "public"."get_total_credits"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_sms_credits"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_subscription_sms_credits integer;
v_purchased_sms_credits integer;
v_event_sms_credits integer;
BEGIN
SELECT
COALESCE(subscription_sms_credits, 0),
COALESCE(purchased_sms_credits, 0),
COALESCE(event_sms_credits, 0)
INTO v_subscription_sms_credits, v_purchased_sms_credits, v_event_sms_credits
FROM user_credits
WHERE user_id = p_user_id;

RETURN v_subscription_sms_credits + v_purchased_sms_credits + v_event_sms_credits;
END;
$$;


ALTER FUNCTION "public"."get_total_sms_credits"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_concurrent_event_limit"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_limit integer;
v_role text;
BEGIN
SELECT role INTO v_role
FROM user_profiles
WHERE id = p_user_id;

IF v_role = 'admin' THEN
RETURN 999999; -- Effectively unlimited
END IF;

SELECT st.concurrent_events
INTO v_limit
FROM user_subscriptions us
JOIN subscription_tiers_new st ON us.tier_id = st.id
WHERE us.user_id = p_user_id
AND us.status = 'active'
AND us.current_period_end > NOW()
ORDER BY us.created_at DESC
LIMIT 1;

IF v_limit IS NOT NULL THEN
RETURN v_limit;
END IF;

SELECT st.concurrent_events
INTO v_limit
FROM user_profiles up
JOIN subscription_tiers_new st ON up.subscription_tier_id = st.id
WHERE up.id = p_user_id
AND up.subscription_status = 'active';

RETURN v_limit;
END;
$$;


ALTER FUNCTION "public"."get_user_concurrent_event_limit"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_credit_balance"("p_user_id" "uuid") RETURNS TABLE("subscription_credits" integer, "purchased_credits" integer, "event_credits" integer, "image_credits" integer, "total_credits" integer, "subscription_sms_credits" integer, "purchased_sms_credits" integer, "event_sms_credits" integer, "total_sms_credits" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
v_subscription_credits integer;
v_purchased_credits integer;
v_event_credits integer;
v_subscription_sms_credits integer;
v_purchased_sms_credits integer;
v_event_sms_credits integer;
BEGIN
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

IF NOT FOUND THEN
v_subscription_credits := 0;
v_purchased_credits := 0;
v_event_credits := 0;
v_subscription_sms_credits := 0;
v_purchased_sms_credits := 0;
v_event_sms_credits := 0;
END IF;

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
$$;


ALTER FUNCTION "public"."get_user_credit_balance"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_event_credits"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
v_credits integer;
BEGIN
SELECT COALESCE(event_credits, 0)
INTO v_credits
FROM user_credits
WHERE user_id = p_user_id;

RETURN COALESCE(v_credits, 0);
END;
$$;


ALTER FUNCTION "public"."get_user_event_credits"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_image_credits"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
v_total integer;
BEGIN
SELECT COALESCE(subscription_credits, 0) + COALESCE(purchased_credits, 0)
INTO v_total
FROM user_credits
WHERE user_id = p_user_id;

RETURN COALESCE(v_total, 0);
END;
$$;


ALTER FUNCTION "public"."get_user_image_credits"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_subscription_info"("p_user_id" "uuid") RETURNS TABLE("subscription_type" "text", "tier_name" "text", "has_active_subscription" boolean, "has_available_passes" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_has_active_sub boolean;
v_available_passes_count integer;
v_subscription_status text;
v_tier_name text;
BEGIN
SELECT up.subscription_status, st.name
INTO v_subscription_status, v_tier_name
FROM user_profiles up
LEFT JOIN subscription_tiers st ON up.subscription_tier_id = st.id
WHERE up.id = p_user_id;

v_has_active_sub := has_active_subscription(p_user_id);

SELECT COUNT(*)
INTO v_available_passes_count
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.user_id = p_user_id
AND uep.activated_at IS NULL
AND ep.duration_hours IS NOT NULL;

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
$$;


ALTER FUNCTION "public"."get_user_subscription_info"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_subscription_type"("p_user_id" "uuid") RETURNS TABLE("subscription_type" "text", "tier_name" "text", "has_active_sub" boolean, "has_available_passes" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_has_active_sub boolean;
v_tier_name text;
v_subscription_status text;
v_available_passes_count integer;
BEGIN
SELECT 
up.subscription_status,
st.name
INTO v_subscription_status, v_tier_name
FROM user_profiles up
LEFT JOIN subscription_tiers_new st ON up.subscription_tier_id = st.id
WHERE up.id = p_user_id;

v_has_active_sub := has_active_subscription(p_user_id);

SELECT COUNT(*)
INTO v_available_passes_count
FROM user_event_passes uep
JOIN event_passes ep ON uep.event_pass_id = ep.id
WHERE uep.user_id = p_user_id
AND uep.activated_at IS NULL
AND ep.duration_hours IS NOT NULL;

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
$$;


ALTER FUNCTION "public"."get_user_subscription_type"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_tenant_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_tenant_id uuid;
BEGIN
SELECT subscription_tier_id INTO v_tenant_id
FROM user_profiles
WHERE id = auth.uid();

RETURN v_tenant_id;
END;
$$;


ALTER FUNCTION "public"."get_user_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_free_tier_id uuid;
v_credit_balance integer;
v_full_name text;
BEGIN
SELECT id INTO v_free_tier_id
FROM subscription_tiers_new
WHERE name = 'Free' AND is_active = true
LIMIT 1;

IF v_free_tier_id IS NULL THEN
RAISE EXCEPTION 'No active Free tier found';
END IF;

v_full_name := COALESCE(
NEW.raw_user_meta_data->>'full_name',
split_part(NEW.email, '@', 1)
);

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

v_credit_balance := 10; -- subscription_credits

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
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "on_auth_user_created" ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


CREATE OR REPLACE FUNCTION "public"."has_activated_event_pass"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_has_pass boolean;
BEGIN
SELECT EXISTS (
SELECT 1 
FROM user_event_passes
WHERE event_id = p_event_id
AND activated_at IS NOT NULL
) INTO v_has_pass;

RETURN COALESCE(v_has_pass, false);
END;
$$;


ALTER FUNCTION "public"."has_activated_event_pass"("p_event_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_activated_event_pass"("p_event_id" "uuid") IS 'Checks if an event has an activated event pass. Used to determine if start time can be modified.';



CREATE OR REPLACE FUNCTION "public"."has_active_subscription"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_new_subscription_count integer;
v_old_subscription_active boolean;
BEGIN
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
$$;


ALTER FUNCTION "public"."has_active_subscription"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_image_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
IF NEW.user_id IS NOT NULL THEN
UPDATE user_credits 
SET images_used = images_used + 1,
updated_at = now()
WHERE user_id = NEW.user_id;
END IF;

UPDATE events 
SET total_generations = total_generations + 1,
updated_at = now()
WHERE id = NEW.event_id;

UPDATE prompts 
SET usage_count = usage_count + 1,
updated_at = now()
WHERE id = NEW.prompt_id;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_image_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_image_usage"("p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
INSERT INTO usage_logs (tenant_id, resource_type, quantity)
VALUES (p_tenant_id, 'images', 1)
ON CONFLICT (tenant_id, resource_type, date)
DO UPDATE SET quantity = usage_logs.quantity + 1;
END;
$$;


ALTER FUNCTION "public"."increment_image_usage"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_sms_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
IF NEW.user_id IS NOT NULL THEN
UPDATE user_credits 
SET sms_used = sms_used + 1,
updated_at = now()
WHERE user_id = NEW.user_id;
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_sms_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_sms_usage"("p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
INSERT INTO usage_logs (tenant_id, resource_type, quantity)
VALUES (p_tenant_id, 'sms', 1)
ON CONFLICT (tenant_id, resource_type, date)
DO UPDATE SET quantity = usage_logs.quantity + 1;
END;
$$;


ALTER FUNCTION "public"."increment_sms_usage"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_user_image_usage"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
UPDATE user_credits 
SET images_used = images_used + 1
WHERE user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."increment_user_image_usage"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_user_sms_usage"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
UPDATE user_credits 
SET sms_used = sms_used + 1
WHERE user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."increment_user_sms_usage"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
RETURN EXISTS (
SELECT 1 FROM user_profiles
WHERE id = auth.uid()
AND role = 'admin'
);
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
SELECT EXISTS (
SELECT 1
FROM user_profiles
WHERE id = auth.uid()
AND lower(role) = 'admin'
);
$$;


ALTER FUNCTION "public"."is_current_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_event_active_and_valid"("event_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
event_record RECORD;
BEGIN
SELECT 
is_active,
start_datetime,
end_datetime
INTO event_record
FROM events
WHERE id = event_id;

IF NOT FOUND THEN
RETURN false;
END IF;

IF event_record.is_active = false THEN
RETURN false;
END IF;

IF event_record.start_datetime IS NOT NULL 
AND NOW() < event_record.start_datetime THEN
RETURN false;
END IF;

IF event_record.end_datetime IS NOT NULL 
AND NOW() > event_record.end_datetime THEN
RETURN false;
END IF;

RETURN true;
END;
$$;


ALTER FUNCTION "public"."is_event_active_and_valid"("event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_pass_active"("p_pass_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_expiration timestamptz;
BEGIN
v_expiration := get_pass_expiration(p_pass_id);

IF v_expiration IS NULL THEN
RETURN false;
END IF;

RETURN NOW() < v_expiration;
END;
$$;


ALTER FUNCTION "public"."is_pass_active"("p_pass_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_prompt_owner"("prompt_id" "uuid", "check_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
SELECT EXISTS (
SELECT 1 FROM prompts
WHERE id = prompt_id
AND user_id = check_user_id
);
$$;


ALTER FUNCTION "public"."is_prompt_owner"("prompt_id" "uuid", "check_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_prompt_owner"("prompt_id" "uuid", "check_user_id" "uuid") IS 'Checks if the specified user owns the given prompt';



CREATE OR REPLACE FUNCTION "public"."prevent_start_time_change_with_activated_pass"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_has_activated_pass boolean;
v_is_admin boolean;
v_start_time_changed boolean;
BEGIN
IF TG_OP = 'UPDATE' THEN
v_start_time_changed := (OLD.start_datetime IS DISTINCT FROM NEW.start_datetime);

IF NOT v_start_time_changed THEN
RETURN NEW;
END IF;

v_is_admin := is_admin(auth.uid());

IF v_is_admin THEN
RETURN NEW;
END IF;

v_has_activated_pass := has_activated_event_pass(OLD.id);

IF v_has_activated_pass THEN
RAISE EXCEPTION 'Cannot modify start time: Event pass has been activated. The start time is now locked.';
END IF;
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_start_time_change_with_activated_pass"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_global_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_global_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_webhook_events_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_webhook_events_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_role"("required_role" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_user_role text;
BEGIN
SELECT role INTO v_user_role
FROM user_profiles
WHERE id = auth.uid();

RETURN v_user_role = required_role;
END;
$$;


ALTER FUNCTION "public"."user_has_role"("required_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_user_role text;
BEGIN
SELECT role INTO v_user_role
FROM user_profiles
WHERE id = auth.uid();

RETURN lower(v_user_role) = 'admin';
END;
$$;


ALTER FUNCTION "public"."user_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_event_time_restrictions"("p_user_id" "uuid", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_pass_id" "uuid", "p_event_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("is_valid" boolean, "error_message" "text", "restriction_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

IF p_pass_id IS NOT NULL THEN
v_event_source := 'event_pass';
ELSE
v_event_source := 'subscription';
END IF;

IF v_event_source = 'subscription' THEN
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

SELECT 
subscription_type,
has_active_sub,
has_available_passes
INTO v_subscription_type, v_has_active_sub, v_has_available_passes
FROM get_user_subscription_type(p_user_id);

IF v_has_active_sub THEN
IF p_pass_id IS NOT NULL THEN
RETURN QUERY SELECT 
false,
'You have an active subscription. Event passes are not needed for subscription accounts.'::text,
'subscription_no_pass'::text;
RETURN;
END IF;

RETURN QUERY SELECT 
true,
NULL::text,
'subscription_unlimited'::text;
RETURN;
END IF;

IF p_pass_id IS NOT NULL THEN
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

IF p_start_datetime IS NULL OR p_end_datetime IS NULL THEN
RETURN QUERY SELECT 
false,
'Event pass events must have start and end times specified.'::text,
'pass_requires_times'::text;
RETURN;
END IF;

IF p_end_datetime <= p_start_datetime THEN
RETURN QUERY SELECT 
false,
'Event end time must be after start time.'::text,
'invalid_time_range'::text;
RETURN;
END IF;

RETURN QUERY SELECT 
true,
NULL::text,
'event_pass_valid'::text;
RETURN;
END IF;

RETURN QUERY SELECT 
false,
'You need an active subscription or event pass to create events.'::text,
'no_subscription_or_pass'::text;
END;
$$;


ALTER FUNCTION "public"."validate_event_time_restrictions"("p_user_id" "uuid", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_pass_id" "uuid", "p_event_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_event_time_restrictions"("p_user_id" "uuid", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_pass_id" "uuid", "p_event_id" "uuid") IS 'Validates event creation restrictions based on user subscription type. Admins bypass all checks.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."add_ons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "stripe_price_id" "text",
    "stripe_product_id" "text",
    "price_cents" integer NOT NULL,
    "delivery_method" "text" DEFAULT 'zoom'::"text",
    "duration_minutes" integer,
    "calendly_link" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."add_ons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "city" "text" DEFAULT ''::"text" NOT NULL,
    "event_date" "date" NOT NULL,
    "passcode" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "total_generations" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "aspect_ratio" "text" DEFAULT 'square'::"text",
    "background_image_url" "text",
    "logo_url" "text",
    "primary_color" "text",
    "secondary_color" "text",
    "accent_color" "text",
    "hide_logo" boolean DEFAULT false,
    "hide_event_name" boolean DEFAULT false,
    "start_datetime" timestamp with time zone,
    "end_datetime" timestamp with time zone,
    "sms_message" "text" DEFAULT 'Here''s your AI-generated photo from {event_name}! {image_url}'::"text",
    "overlay_image_url" "text",
    "smugmug_gallery_id" "text",
    "smugmug_gallery_url" "text",
    "smugmug_gallery_visibility" "text" DEFAULT 'private'::"text",
    "smugmug_gallery_name" "text",
    "smugmug_gallery_key" "text",
    "upload_originals_to_gallery" boolean DEFAULT false,
    "user_id" "uuid",
    "event_source" "text" DEFAULT 'subscription'::"text",
    CONSTRAINT "events_aspect_ratio_check" CHECK (("aspect_ratio" = ANY (ARRAY['square'::"text", '3:4'::"text", '4:3'::"text", '9:16'::"text", '16:9'::"text"]))),
    CONSTRAINT "events_event_source_check" CHECK (("event_source" = ANY (ARRAY['subscription'::"text", 'event_pass'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "category" "text" DEFAULT 'Custom'::"text" NOT NULL,
    "prompt_text" "text" NOT NULL,
    "preview_image_url" "text" NOT NULL,
    "reference_image_url" "text",
    "is_active" boolean DEFAULT true,
    "usage_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "is_public" boolean DEFAULT false,
    "user_id" "uuid",
    "source_prompt_id" "uuid",
    CONSTRAINT "prompts_source_not_self" CHECK (("id" <> "source_prompt_id"))
);


ALTER TABLE "public"."prompts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."prompts"."tags" IS 'Array of tags for categorizing and filtering prompts (e.g., holiday, professional, fun, vintage)';



COMMENT ON COLUMN "public"."prompts"."source_prompt_id" IS 'References the original prompt if this is a duplicate';



CREATE TABLE IF NOT EXISTS "public"."subscription_tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "plan_type" "text" NOT NULL,
    "tier" "text" NOT NULL,
    "price_cents" integer NOT NULL,
    "credits_per_period" integer NOT NULL,
    "stripe_product_id" "text",
    "stripe_price_id" "text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "description" "text",
    "features" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sms_credits_per_period" integer DEFAULT 0,
    CONSTRAINT "subscription_tiers_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['monthly'::"text", 'annual'::"text"]))),
    CONSTRAINT "subscription_tiers_tier_check" CHECK (("tier" = ANY (ARRAY['starter'::"text", 'pro'::"text", 'premium'::"text", 'agency'::"text"])))
);


ALTER TABLE "public"."subscription_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "images_limit" integer DEFAULT 10 NOT NULL,
    "images_used" integer DEFAULT 0,
    "sms_limit" integer DEFAULT 5 NOT NULL,
    "sms_used" integer DEFAULT 0,
    "events_limit" integer DEFAULT 1 NOT NULL,
    "reset_date" timestamp with time zone DEFAULT ("date_trunc"('month'::"text", "now"()) + '1 mon'::interval),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "plan_type" "text" DEFAULT 'free'::"text",
    "subscription_tier_id" "uuid",
    "purchased_event_pass_id" "uuid",
    "expires_at" timestamp with time zone,
    "annual_credits_total" integer,
    "annual_credits_used" integer DEFAULT 0,
    "billing_period_start" timestamp with time zone,
    "billing_period_end" timestamp with time zone,
    "subscription_credits" integer DEFAULT 0,
    "purchased_credits" integer DEFAULT 0,
    "event_credits" integer DEFAULT 0,
    "subscription_sms_credits" integer DEFAULT 0,
    "purchased_sms_credits" integer DEFAULT 0,
    "event_sms_credits" integer DEFAULT 0,
    CONSTRAINT "user_credits_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['free'::"text", 'monthly'::"text", 'annual'::"text", 'event'::"text", 'topup'::"text"])))
);


ALTER TABLE "public"."user_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "subscription_status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "subscription_ends_at" timestamp with time zone,
    "trial_ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subscription_tier_id" "uuid",
    "subscription_start_date" timestamp with time zone,
    "subscription_end_date" timestamp with time zone,
    "role" "text" DEFAULT 'user'::"text",
    "dropbox_app_key" "text",
    "dropbox_app_secret" "text",
    "dropbox_access_token" "text",
    "dropbox_refresh_token" "text",
    "display_name" "text",
    "profile_picture_url" "text",
    "bio" "text",
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    CONSTRAINT "user_profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tier_id" "uuid" NOT NULL,
    "stripe_subscription_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "current_period_start" timestamp with time zone NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "cancel_at_period_end" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text", 'expired'::"text", 'past_due'::"text"])))
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_subscriptions"."cancel_at_period_end" IS 'Flag indicating if the subscription is scheduled to cancel at the end of the current period';



CREATE OR REPLACE VIEW "public"."admin_all_users" WITH ("security_invoker"='true') AS
 SELECT "up"."id",
    "up"."email",
    "up"."full_name",
    "up"."display_name",
    "up"."role",
    "up"."created_at",
    "up"."updated_at",
    "us"."id" AS "subscription_id",
    "us"."status" AS "subscription_status",
    "us"."tier_id" AS "subscription_tier_id",
    "st"."name" AS "subscription_tier_name",
    "st"."plan_type",
    "us"."stripe_subscription_id",
    "us"."current_period_start" AS "subscription_start_date",
    "us"."current_period_end" AS "subscription_end_date",
    "us"."cancel_at_period_end",
    "uc"."images_limit",
    "uc"."images_used",
    "uc"."sms_limit",
    "uc"."sms_used",
    "uc"."events_limit",
    "uc"."reset_date",
    "uc"."subscription_credits",
    "uc"."purchased_credits",
    "uc"."event_credits",
    "uc"."subscription_sms_credits",
    "uc"."purchased_sms_credits",
    "uc"."event_sms_credits",
    ( SELECT "count"(*) AS "count"
           FROM "public"."events"
          WHERE ("events"."user_id" = "up"."id")) AS "total_events",
    ( SELECT "count"(*) AS "count"
           FROM "public"."prompts"
          WHERE ("prompts"."user_id" = "up"."id")) AS "total_prompts"
   FROM ((("public"."user_profiles" "up"
     LEFT JOIN "public"."user_subscriptions" "us" ON ((("up"."id" = "us"."user_id") AND ("us"."status" = 'active'::"text"))))
     LEFT JOIN "public"."subscription_tiers" "st" ON (("us"."tier_id" = "st"."id")))
     LEFT JOIN "public"."user_credits" "uc" ON (("up"."id" = "uc"."user_id")));


ALTER VIEW "public"."admin_all_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "amount" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "stripe_session_id" "text",
    "stripe_payment_intent_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sms_amount" integer DEFAULT 0,
    "sms_balance_after" integer DEFAULT 0,
    CONSTRAINT "credit_ledger_source_check" CHECK (("source" = ANY (ARRAY['subscription'::"text", 'credit_pack'::"text", 'event'::"text", 'admin_grant'::"text", 'consumption'::"text"])))
);


ALTER TABLE "public"."credit_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_topup_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "credits" integer NOT NULL,
    "price_cents" integer NOT NULL,
    "stripe_price_id" "text",
    "stripe_product_id" "text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sms_credits" integer DEFAULT 0
);


ALTER TABLE "public"."credit_topup_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "transaction_type" "text" NOT NULL,
    "description" "text",
    "reference_id" "uuid",
    "balance_after" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credit_transactions_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['purchase'::"text", 'subscription'::"text", 'event_pass'::"text", 'usage'::"text", 'refund'::"text", 'reset'::"text", 'rollover'::"text"])))
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "granted_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_pass_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchased_event_pass_id" "uuid" NOT NULL,
    "addon_id" "uuid" NOT NULL,
    "stripe_payment_intent_id" "text",
    "purchased_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_pass_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_passes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "stripe_price_id" "text",
    "stripe_product_id" "text",
    "price_cents" integer NOT NULL,
    "credits" integer NOT NULL,
    "duration_hours" integer NOT NULL,
    "setup_included" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "prompts_limit" integer,
    "features" "jsonb",
    "sms_credits" integer DEFAULT 0,
    "events_allowed" integer DEFAULT 1,
    "deterministic_seeds" boolean DEFAULT false,
    "priority_queue" boolean DEFAULT false,
    "prompt_locking" boolean DEFAULT false,
    "admin_controls" boolean DEFAULT false,
    "brand_locking" boolean DEFAULT false
);


ALTER TABLE "public"."event_passes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_prompts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "prompt_id" "uuid" NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_prompts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_images" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "prompt_id" "uuid" NOT NULL,
    "original_image_url" "text",
    "generated_image_url" "text",
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "error_message" "text",
    "phone_number" "text",
    "generation_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "user_id" "uuid",
    CONSTRAINT "generated_images_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."generated_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."global_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "text",
    "description" "text",
    "is_sensitive" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "smugmug_oauth_token" "text",
    "smugmug_oauth_token_secret" "text",
    "smugmug_user_nickname" "text",
    "smugmug_connection_status" "text" DEFAULT 'disconnected'::"text",
    "smugmug_last_auth_date" timestamp with time zone,
    "smugmug_default_visibility" "text" DEFAULT 'private'::"text",
    "use_smugmug_for_sms" boolean DEFAULT true,
    "smugmug_request_token_secret" "text",
    "smugmug_username" "text",
    "gemini_api_key" "text",
    "gemini_enabled" boolean DEFAULT false,
    "gemini_model" "text" DEFAULT 'gemini-3-pro-image-preview'::"text",
    "gemini_resolution" "text" DEFAULT '1K'::"text",
    "twilio_account_sid" "text",
    "twilio_auth_token" "text",
    "twilio_phone_number" "text",
    "twilio_enabled" boolean DEFAULT false,
    "dropbox_app_key" "text",
    "dropbox_app_secret" "text",
    "singleton_id" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."global_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchased_event_passes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "event_pass_tier_id" "uuid" NOT NULL,
    "stripe_payment_intent_id" "text",
    "credits_allocated" integer NOT NULL,
    "credits_used" integer DEFAULT 0,
    "prompt_limit" integer NOT NULL,
    "prompts_used" integer DEFAULT 0,
    "purchased_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sms_credits_allocated" integer DEFAULT 0,
    "sms_credits_used" integer DEFAULT 0
);


ALTER TABLE "public"."purchased_event_passes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "image_id" "uuid" NOT NULL,
    "phone_number" "text" NOT NULL,
    "message_sid" "text",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "error_message" "text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "delivered_at" timestamp with time zone,
    "user_id" "uuid",
    CONSTRAINT "sms_logs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'delivered'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."sms_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smugmug_upload_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "generated_image_id" "uuid",
    "event_id" "uuid",
    "image_url" "text" NOT NULL,
    "upload_status" "text" DEFAULT 'pending'::"text",
    "retry_count" integer DEFAULT 0,
    "last_attempt_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."smugmug_upload_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_customers" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."stripe_customers" OWNER TO "postgres";


ALTER TABLE "public"."stripe_customers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."stripe_customers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."stripe_orders" (
    "id" bigint NOT NULL,
    "checkout_session_id" "text" NOT NULL,
    "payment_intent_id" "text" NOT NULL,
    "customer_id" "text" NOT NULL,
    "amount_subtotal" bigint NOT NULL,
    "amount_total" bigint NOT NULL,
    "currency" "text" NOT NULL,
    "payment_status" "text" NOT NULL,
    "status" "public"."stripe_order_status" DEFAULT 'pending'::"public"."stripe_order_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."stripe_orders" OWNER TO "postgres";


ALTER TABLE "public"."stripe_orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."stripe_orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."stripe_subscriptions" (
    "id" bigint NOT NULL,
    "customer_id" "text" NOT NULL,
    "subscription_id" "text",
    "price_id" "text",
    "current_period_start" bigint,
    "current_period_end" bigint,
    "cancel_at_period_end" boolean DEFAULT false,
    "payment_method_brand" "text",
    "payment_method_last4" "text",
    "status" "public"."stripe_subscription_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."stripe_subscriptions" OWNER TO "postgres";


ALTER TABLE "public"."stripe_subscriptions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."stripe_subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."stripe_user_orders" WITH ("security_invoker"='true') AS
 SELECT "c"."customer_id",
    "o"."id" AS "order_id",
    "o"."checkout_session_id",
    "o"."payment_intent_id",
    "o"."amount_subtotal",
    "o"."amount_total",
    "o"."currency",
    "o"."payment_status",
    "o"."status" AS "order_status",
    "o"."created_at" AS "order_date"
   FROM ("public"."stripe_customers" "c"
     LEFT JOIN "public"."stripe_orders" "o" ON (("c"."customer_id" = "o"."customer_id")))
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."deleted_at" IS NULL) AND ("o"."deleted_at" IS NULL));


ALTER VIEW "public"."stripe_user_orders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."stripe_user_subscriptions" WITH ("security_invoker"='true') AS
 SELECT "c"."customer_id",
    "s"."subscription_id",
    "s"."status" AS "subscription_status",
    "s"."price_id",
    "s"."current_period_start",
    "s"."current_period_end",
    "s"."cancel_at_period_end",
    "s"."payment_method_brand",
    "s"."payment_method_last4"
   FROM ("public"."stripe_customers" "c"
     LEFT JOIN "public"."stripe_subscriptions" "s" ON (("c"."customer_id" = "s"."customer_id")))
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."deleted_at" IS NULL) AND ("s"."deleted_at" IS NULL));


ALTER VIEW "public"."stripe_user_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_tiers_new" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "stripe_price_id" "text",
    "stripe_product_id" "text",
    "billing_period" "text" NOT NULL,
    "price_cents" integer NOT NULL,
    "credits_per_period" integer NOT NULL,
    "rollover_enabled" boolean DEFAULT false,
    "features" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "prompts_limit" integer,
    "sms_credits_per_period" integer DEFAULT 0,
    "concurrent_events" integer DEFAULT 1,
    "deterministic_seeds" boolean DEFAULT false,
    "priority_queue" boolean DEFAULT false,
    "brand_controls" boolean DEFAULT false,
    "team_accounts" boolean DEFAULT false,
    "tier_category" "text" DEFAULT 'standard'::"text",
    CONSTRAINT "subscription_tiers_new_billing_period_check" CHECK (("billing_period" = ANY (ARRAY['monthly'::"text", 'annual'::"text"]))),
    CONSTRAINT "subscription_tiers_new_tier_category_check" CHECK (("tier_category" = ANY (ARRAY['standard'::"text", 'activation'::"text"])))
);


ALTER TABLE "public"."subscription_tiers_new" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid",
    "action_type" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."usage_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_add_on_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "add_on_id" "uuid" NOT NULL,
    "stripe_payment_id" "text",
    "scheduled_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "calendly_event_id" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_add_on_purchases_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'scheduled'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."user_add_on_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_event_passes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_pass_id" "uuid" NOT NULL,
    "stripe_payment_id" "text",
    "credits_allocated" integer NOT NULL,
    "credits_used" integer DEFAULT 0,
    "activated_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_id" "uuid"
);


ALTER TABLE "public"."user_event_passes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "dropbox_enabled" boolean DEFAULT false,
    "dropbox_app_key" "text",
    "dropbox_app_secret" "text",
    "dropbox_access_token" "text",
    "dropbox_refresh_token" "text",
    "dropbox_token_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processing_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "user_id" "uuid",
    "customer_id" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processing_started_at" timestamp with time zone,
    "processing_completed_at" timestamp with time zone,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "webhook_events_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."add_ons"
    ADD CONSTRAINT "add_ons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."add_ons"
    ADD CONSTRAINT "add_ons_stripe_product_id_key" UNIQUE ("stripe_product_id");



ALTER TABLE ONLY "public"."credit_ledger"
    ADD CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_topup_products"
    ADD CONSTRAINT "credit_topup_products_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."credit_topup_products"
    ADD CONSTRAINT "credit_topup_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_topup_products"
    ADD CONSTRAINT "credit_topup_products_stripe_product_id_key" UNIQUE ("stripe_product_id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_access"
    ADD CONSTRAINT "event_access_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_access"
    ADD CONSTRAINT "event_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_pass_addons"
    ADD CONSTRAINT "event_pass_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_passes"
    ADD CONSTRAINT "event_passes_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."event_passes"
    ADD CONSTRAINT "event_passes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_passes"
    ADD CONSTRAINT "event_passes_stripe_product_id_key" UNIQUE ("stripe_product_id");



ALTER TABLE ONLY "public"."event_prompts"
    ADD CONSTRAINT "event_prompts_event_id_prompt_id_key" UNIQUE ("event_id", "prompt_id");



ALTER TABLE ONLY "public"."event_prompts"
    ADD CONSTRAINT "event_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_passcode_unique" UNIQUE ("passcode");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generated_images"
    ADD CONSTRAINT "generated_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_settings"
    ADD CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_settings"
    ADD CONSTRAINT "global_settings_setting_key_key" UNIQUE ("setting_key");



ALTER TABLE ONLY "public"."global_settings"
    ADD CONSTRAINT "global_settings_singleton" UNIQUE ("singleton_id");



ALTER TABLE ONLY "public"."prompts"
    ADD CONSTRAINT "prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchased_event_passes"
    ADD CONSTRAINT "purchased_event_passes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smugmug_upload_queue"
    ADD CONSTRAINT "smugmug_upload_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_customer_id_key" UNIQUE ("customer_id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."stripe_orders"
    ADD CONSTRAINT "stripe_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_subscriptions"
    ADD CONSTRAINT "stripe_subscriptions_customer_id_key" UNIQUE ("customer_id");



ALTER TABLE ONLY "public"."stripe_subscriptions"
    ADD CONSTRAINT "stripe_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_tiers_new"
    ADD CONSTRAINT "subscription_tiers_new_name_billing_period_key" UNIQUE ("name", "billing_period");



ALTER TABLE ONLY "public"."subscription_tiers_new"
    ADD CONSTRAINT "subscription_tiers_new_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_tiers"
    ADD CONSTRAINT "subscription_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_tiers"
    ADD CONSTRAINT "subscription_tiers_plan_type_tier_key" UNIQUE ("plan_type", "tier");



ALTER TABLE ONLY "public"."subscription_tiers"
    ADD CONSTRAINT "subscription_tiers_stripe_price_id_key" UNIQUE ("stripe_price_id");



ALTER TABLE ONLY "public"."subscription_tiers"
    ADD CONSTRAINT "subscription_tiers_stripe_product_id_key" UNIQUE ("stripe_product_id");



ALTER TABLE ONLY "public"."usage_logs"
    ADD CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_add_on_purchases"
    ADD CONSTRAINT "user_add_on_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_event_passes"
    ADD CONSTRAINT "user_event_passes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_credit_ledger_created_at" ON "public"."credit_ledger" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_credit_ledger_source" ON "public"."credit_ledger" USING "btree" ("source");



CREATE INDEX "idx_credit_ledger_stripe_session" ON "public"."credit_ledger" USING "btree" ("stripe_session_id");



CREATE INDEX "idx_credit_ledger_user_id" ON "public"."credit_ledger" USING "btree" ("user_id");



CREATE INDEX "idx_credit_topup_products_active_display" ON "public"."credit_topup_products" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_credit_transactions_user_id" ON "public"."credit_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_event_access_event_id" ON "public"."event_access" USING "btree" ("event_id");



CREATE INDEX "idx_event_access_granted_by" ON "public"."event_access" USING "btree" ("granted_by");



CREATE INDEX "idx_event_access_user_id" ON "public"."event_access" USING "btree" ("user_id");



CREATE INDEX "idx_event_pass_addons_addon_id" ON "public"."event_pass_addons" USING "btree" ("addon_id");



CREATE INDEX "idx_event_pass_addons_purchased_event_pass_id" ON "public"."event_pass_addons" USING "btree" ("purchased_event_pass_id");



CREATE INDEX "idx_event_passes_active_display" ON "public"."event_passes" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_event_passes_deterministic" ON "public"."event_passes" USING "btree" ("deterministic_seeds");



CREATE INDEX "idx_event_passes_priority" ON "public"."event_passes" USING "btree" ("priority_queue");



CREATE INDEX "idx_event_prompts_display_order" ON "public"."event_prompts" USING "btree" ("event_id", "display_order");



CREATE INDEX "idx_event_prompts_prompt_id" ON "public"."event_prompts" USING "btree" ("prompt_id");



CREATE INDEX "idx_events_user_active_source" ON "public"."events" USING "btree" ("user_id", "is_active", "event_source") WHERE ("is_active" = true);



CREATE INDEX "idx_events_user_id" ON "public"."events" USING "btree" ("user_id");



CREATE INDEX "idx_generated_images_event_id" ON "public"."generated_images" USING "btree" ("event_id");



CREATE INDEX "idx_generated_images_prompt_id" ON "public"."generated_images" USING "btree" ("prompt_id");



CREATE INDEX "idx_generated_images_user_id" ON "public"."generated_images" USING "btree" ("user_id");



CREATE INDEX "idx_prompts_is_active" ON "public"."prompts" USING "btree" ("is_active");



CREATE INDEX "idx_prompts_is_active_created_at" ON "public"."prompts" USING "btree" ("is_active", "created_at" DESC);



CREATE INDEX "idx_prompts_source_prompt_id" ON "public"."prompts" USING "btree" ("source_prompt_id");



CREATE INDEX "idx_prompts_user_id" ON "public"."prompts" USING "btree" ("user_id");



CREATE INDEX "idx_purchased_event_passes_event_id" ON "public"."purchased_event_passes" USING "btree" ("event_id");



CREATE INDEX "idx_purchased_event_passes_event_pass_tier_id" ON "public"."purchased_event_passes" USING "btree" ("event_pass_tier_id");



CREATE INDEX "idx_purchased_event_passes_expires_at" ON "public"."purchased_event_passes" USING "btree" ("expires_at");



CREATE INDEX "idx_purchased_event_passes_user_id" ON "public"."purchased_event_passes" USING "btree" ("user_id");



CREATE INDEX "idx_sms_logs_image_id" ON "public"."sms_logs" USING "btree" ("image_id");



CREATE INDEX "idx_sms_logs_user_id" ON "public"."sms_logs" USING "btree" ("user_id");



CREATE INDEX "idx_smugmug_upload_queue_event" ON "public"."smugmug_upload_queue" USING "btree" ("event_id");



CREATE INDEX "idx_smugmug_upload_queue_generated_image_id_fkey" ON "public"."smugmug_upload_queue" USING "btree" ("generated_image_id");



CREATE INDEX "idx_subscription_tiers_category" ON "public"."subscription_tiers_new" USING "btree" ("tier_category");



CREATE INDEX "idx_subscription_tiers_concurrent" ON "public"."subscription_tiers_new" USING "btree" ("concurrent_events");



CREATE INDEX "idx_subscription_tiers_new_active_display" ON "public"."subscription_tiers_new" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_subscription_tiers_new_billing_period" ON "public"."subscription_tiers_new" USING "btree" ("billing_period");



CREATE INDEX "idx_usage_logs_event_id" ON "public"."usage_logs" USING "btree" ("event_id");



CREATE INDEX "idx_usage_logs_user_id" ON "public"."usage_logs" USING "btree" ("user_id");



CREATE INDEX "idx_user_add_on_purchases_add_on_id" ON "public"."user_add_on_purchases" USING "btree" ("add_on_id");



CREATE INDEX "idx_user_add_on_purchases_user_id" ON "public"."user_add_on_purchases" USING "btree" ("user_id");



CREATE INDEX "idx_user_credits_event_sms_credits" ON "public"."user_credits" USING "btree" ("event_sms_credits");



CREATE INDEX "idx_user_credits_expires_at" ON "public"."user_credits" USING "btree" ("expires_at");



CREATE INDEX "idx_user_credits_purchased_event_pass_id" ON "public"."user_credits" USING "btree" ("purchased_event_pass_id");



CREATE INDEX "idx_user_credits_purchased_sms_credits" ON "public"."user_credits" USING "btree" ("purchased_sms_credits");



CREATE INDEX "idx_user_credits_sms_credits" ON "public"."user_credits" USING "btree" ("subscription_sms_credits", "purchased_sms_credits", "event_sms_credits");



CREATE INDEX "idx_user_credits_subscription_sms_credits" ON "public"."user_credits" USING "btree" ("subscription_sms_credits");



CREATE INDEX "idx_user_credits_subscription_tier_id" ON "public"."user_credits" USING "btree" ("subscription_tier_id");



CREATE INDEX "idx_user_credits_user_id" ON "public"."user_credits" USING "btree" ("user_id");



CREATE INDEX "idx_user_event_passes_activated_at" ON "public"."user_event_passes" USING "btree" ("activated_at");



CREATE INDEX "idx_user_event_passes_event_id" ON "public"."user_event_passes" USING "btree" ("event_id");



CREATE INDEX "idx_user_event_passes_event_pass_id" ON "public"."user_event_passes" USING "btree" ("event_pass_id");



CREATE INDEX "idx_user_event_passes_user_id" ON "public"."user_event_passes" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_subscription_status" ON "public"."user_profiles" USING "btree" ("subscription_status", "subscription_tier_id");



CREATE INDEX "idx_user_profiles_subscription_tier_id" ON "public"."user_profiles" USING "btree" ("subscription_tier_id");



CREATE INDEX "idx_user_settings_user_id" ON "public"."user_settings" USING "btree" ("user_id");



CREATE INDEX "idx_user_subscriptions_cancel_status" ON "public"."user_subscriptions" USING "btree" ("user_id", "status", "cancel_at_period_end") WHERE ("status" = ANY (ARRAY['active'::"text", 'trialing'::"text"]));



CREATE INDEX "idx_user_subscriptions_status" ON "public"."user_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_user_subscriptions_stripe_id" ON "public"."user_subscriptions" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_user_subscriptions_tier_id" ON "public"."user_subscriptions" USING "btree" ("tier_id");



CREATE INDEX "idx_user_subscriptions_user_id" ON "public"."user_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_user_subscriptions_user_status" ON "public"."user_subscriptions" USING "btree" ("user_id", "status") WHERE ("status" = ANY (ARRAY['active'::"text", 'trialing'::"text"]));



CREATE INDEX "idx_webhook_events_created_at" ON "public"."webhook_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_webhook_events_customer_id" ON "public"."webhook_events" USING "btree" ("customer_id");



CREATE INDEX "idx_webhook_events_event_id" ON "public"."webhook_events" USING "btree" ("event_id");



CREATE INDEX "idx_webhook_events_status" ON "public"."webhook_events" USING "btree" ("processing_status");



CREATE INDEX "idx_webhook_events_user_id" ON "public"."webhook_events" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "prevent_start_time_change_on_events" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_start_time_change_with_activated_pass"();



COMMENT ON TRIGGER "prevent_start_time_change_on_events" ON "public"."events" IS 'Prevents start time modifications for events with activated event passes. Admin users can bypass this restriction.';



CREATE OR REPLACE TRIGGER "track_image_generation" AFTER INSERT ON "public"."generated_images" FOR EACH ROW EXECUTE FUNCTION "public"."increment_image_usage"();



CREATE OR REPLACE TRIGGER "track_sms_sent" AFTER INSERT ON "public"."sms_logs" FOR EACH ROW EXECUTE FUNCTION "public"."increment_sms_usage"();



CREATE OR REPLACE TRIGGER "update_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_global_settings_updated_at" BEFORE UPDATE ON "public"."global_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_global_settings_updated_at"();



CREATE OR REPLACE TRIGGER "update_prompts_updated_at" BEFORE UPDATE ON "public"."prompts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_credits_updated_at" BEFORE UPDATE ON "public"."user_credits" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "user_settings_updated_at" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_settings_updated_at"();



CREATE OR REPLACE TRIGGER "webhook_events_updated_at" BEFORE UPDATE ON "public"."webhook_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_webhook_events_updated_at"();



ALTER TABLE ONLY "public"."credit_ledger"
    ADD CONSTRAINT "credit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_access"
    ADD CONSTRAINT "event_access_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_access"
    ADD CONSTRAINT "event_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_access"
    ADD CONSTRAINT "event_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_pass_addons"
    ADD CONSTRAINT "event_pass_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."add_ons"("id");



ALTER TABLE ONLY "public"."event_pass_addons"
    ADD CONSTRAINT "event_pass_addons_purchased_event_pass_id_fkey" FOREIGN KEY ("purchased_event_pass_id") REFERENCES "public"."purchased_event_passes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_prompts"
    ADD CONSTRAINT "event_prompts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_prompts"
    ADD CONSTRAINT "event_prompts_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generated_images"
    ADD CONSTRAINT "generated_images_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generated_images"
    ADD CONSTRAINT "generated_images_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generated_images"
    ADD CONSTRAINT "generated_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompts"
    ADD CONSTRAINT "prompts_source_prompt_id_fkey" FOREIGN KEY ("source_prompt_id") REFERENCES "public"."prompts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prompts"
    ADD CONSTRAINT "prompts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchased_event_passes"
    ADD CONSTRAINT "purchased_event_passes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchased_event_passes"
    ADD CONSTRAINT "purchased_event_passes_event_pass_tier_id_fkey" FOREIGN KEY ("event_pass_tier_id") REFERENCES "public"."event_passes"("id");



ALTER TABLE ONLY "public"."purchased_event_passes"
    ADD CONSTRAINT "purchased_event_passes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."generated_images"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smugmug_upload_queue"
    ADD CONSTRAINT "smugmug_upload_queue_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smugmug_upload_queue"
    ADD CONSTRAINT "smugmug_upload_queue_generated_image_id_fkey" FOREIGN KEY ("generated_image_id") REFERENCES "public"."generated_images"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."usage_logs"
    ADD CONSTRAINT "usage_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usage_logs"
    ADD CONSTRAINT "usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_add_on_purchases"
    ADD CONSTRAINT "user_add_on_purchases_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "public"."add_ons"("id");



ALTER TABLE ONLY "public"."user_add_on_purchases"
    ADD CONSTRAINT "user_add_on_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_purchased_event_pass_id_fkey" FOREIGN KEY ("purchased_event_pass_id") REFERENCES "public"."purchased_event_passes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_subscription_tier_id_fkey" FOREIGN KEY ("subscription_tier_id") REFERENCES "public"."subscription_tiers_new"("id");



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_event_passes"
    ADD CONSTRAINT "user_event_passes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_event_passes"
    ADD CONSTRAINT "user_event_passes_event_pass_id_fkey" FOREIGN KEY ("event_pass_id") REFERENCES "public"."event_passes"("id");



ALTER TABLE ONLY "public"."user_event_passes"
    ADD CONSTRAINT "user_event_passes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_subscription_tier_id_fkey" FOREIGN KEY ("subscription_tier_id") REFERENCES "public"."subscription_tiers_new"("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers_new"("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Admins can delete add-ons" ON "public"."add_ons" FOR DELETE TO "authenticated" USING ("public"."is_current_user_admin"());



CREATE POLICY "Admins can delete event passes" ON "public"."event_passes" FOR DELETE TO "authenticated" USING ("public"."is_current_user_admin"());



CREATE POLICY "Admins can delete subscription tiers" ON "public"."subscription_tiers_new" FOR DELETE TO "authenticated" USING ("public"."is_current_user_admin"());



CREATE POLICY "Admins can insert add-ons" ON "public"."add_ons" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can insert event passes" ON "public"."event_passes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can insert global settings" ON "public"."global_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can insert subscription tiers" ON "public"."subscription_tiers_new" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can manage all event access" ON "public"."event_access" TO "authenticated" USING (( SELECT "public"."user_is_admin"() AS "user_is_admin")) WITH CHECK (( SELECT "public"."user_is_admin"() AS "user_is_admin"));



CREATE POLICY "Admins can manage all purchased passes" ON "public"."purchased_event_passes" TO "authenticated" USING (( SELECT "public"."user_is_admin"() AS "user_is_admin")) WITH CHECK (( SELECT "public"."user_is_admin"() AS "user_is_admin"));



CREATE POLICY "Admins can manage all subscriptions" ON "public"."user_subscriptions" TO "authenticated" USING (( SELECT "public"."user_is_admin"() AS "user_is_admin")) WITH CHECK (( SELECT "public"."user_is_admin"() AS "user_is_admin"));



CREATE POLICY "Admins can manage tiers" ON "public"."subscription_tiers" TO "authenticated" USING (( SELECT "public"."user_is_admin"() AS "user_is_admin")) WITH CHECK (( SELECT "public"."user_is_admin"() AS "user_is_admin"));



CREATE POLICY "Admins can manage topup products" ON "public"."credit_topup_products" TO "authenticated" USING (( SELECT "public"."user_is_admin"() AS "user_is_admin")) WITH CHECK (( SELECT "public"."user_is_admin"() AS "user_is_admin"));



CREATE POLICY "Admins can update add-ons" ON "public"."add_ons" FOR UPDATE TO "authenticated" USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can update event passes" ON "public"."event_passes" FOR UPDATE TO "authenticated" USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can update global settings" ON "public"."global_settings" FOR UPDATE TO "authenticated" USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can update subscription tiers" ON "public"."subscription_tiers_new" FOR UPDATE TO "authenticated" USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can update upload queue" ON "public"."smugmug_upload_queue" FOR UPDATE TO "authenticated" USING ("public"."user_is_admin"()) WITH CHECK ("public"."user_is_admin"());



CREATE POLICY "Admins can view all subscription tiers" ON "public"."subscription_tiers_new" FOR SELECT TO "authenticated" USING ("public"."is_current_user_admin"());



CREATE POLICY "Admins can view all webhook events" ON "public"."webhook_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view upload queue" ON "public"."smugmug_upload_queue" FOR SELECT TO "authenticated" USING ("public"."user_is_admin"());



CREATE POLICY "Anonymous can view public prompts or prompts in active events" ON "public"."prompts" FOR SELECT TO "anon" USING ((("is_active" = true) AND (("is_public" = true) OR (EXISTS ( SELECT 1
   FROM ("public"."event_prompts" "ep"
     JOIN "public"."events" "e" ON (("e"."id" = "ep"."event_id")))
  WHERE (("ep"."prompt_id" = "prompts"."id") AND ("e"."is_active" = true)))))));



CREATE POLICY "Anonymous users can insert images to active events" ON "public"."generated_images" FOR INSERT TO "anon" WITH CHECK ("public"."is_event_active_and_valid"("event_id"));



CREATE POLICY "Anonymous users can view generated images" ON "public"."generated_images" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anyone can read active tiers" ON "public"."subscription_tiers_new" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Anyone can read global settings" ON "public"."global_settings" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view active add-ons" ON "public"."add_ons" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin")));



CREATE POLICY "Anyone can view active passes" ON "public"."event_passes" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin")));



CREATE POLICY "Anyone can view active tiers" ON "public"."subscription_tiers" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin")));



CREATE POLICY "Anyone can view active topup products" ON "public"."credit_topup_products" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin")));



CREATE POLICY "Auth system can create profiles" ON "public"."user_profiles" FOR INSERT TO "authenticated", "anon" WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Authenticated users can insert images to active events" ON "public"."generated_images" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_event_active_and_valid"("event_id"));



CREATE POLICY "Authenticated users can queue uploads" ON "public"."smugmug_upload_queue" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "smugmug_upload_queue"."event_id") AND (("e"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin"))))));



CREATE POLICY "Only owners can delete their prompts" ON "public"."prompts" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"()));



CREATE POLICY "Only owners can edit their prompts" ON "public"."prompts" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"())) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"()));



CREATE POLICY "Public can view active events" ON "public"."events" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "Public can view event prompts for active events" ON "public"."event_prompts" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_prompts"."event_id") AND ("events"."is_active" = true)))));



CREATE POLICY "System can create credits" ON "public"."user_credits" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin")));



CREATE POLICY "System can update SMS logs for valid images" ON "public"."sms_logs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."generated_images"
  WHERE ("generated_images"."id" = "sms_logs"."image_id")))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."generated_images"
  WHERE ("generated_images"."id" = "sms_logs"."image_id"))));



CREATE POLICY "Users can create images for active events" ON "public"."generated_images" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "generated_images"."event_id") AND ("e"."is_active" = true) AND (("e"."start_datetime" IS NULL) OR ("e"."start_datetime" <= "now"())) AND (("e"."end_datetime" IS NULL) OR ("e"."end_datetime" >= "now"()))))));



CREATE POLICY "Users can create prompts they own" ON "public"."prompts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"()));



CREATE POLICY "Users can delete event prompts for own events" ON "public"."event_prompts" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_prompts"."event_id") AND ("events"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can delete own events or admin can delete all" ON "public"."events" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"()));



CREATE POLICY "Users can delete own settings" ON "public"."user_settings" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert event prompts for own events" ON "public"."event_prompts" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_prompts"."event_id") AND ("events"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can insert own events" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert own prompts" ON "public"."prompts" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert own settings" ON "public"."user_settings" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert sms logs" ON "public"."sms_logs" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" IS NULL)));



CREATE POLICY "Users can insert usage logs" ON "public"."usage_logs" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" IS NULL)));



CREATE POLICY "Users can read own add-on purchases" ON "public"."user_add_on_purchases" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own event passes" ON "public"."user_event_passes" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own settings" ON "public"."user_settings" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own sms logs" ON "public"."sms_logs" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own transactions" ON "public"."credit_transactions" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can read own usage logs" ON "public"."usage_logs" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update credits" ON "public"."user_credits" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin"))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin")));



CREATE POLICY "Users can update own events or admin can update all" ON "public"."events" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR ("user_id" = "auth"."uid"()) OR "public"."is_current_user_admin"())) WITH CHECK ((("created_by" = "auth"."uid"()) OR ("user_id" = "auth"."uid"()) OR "public"."is_current_user_admin"()));



CREATE POLICY "Users can update own settings" ON "public"."user_settings" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update profiles" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin"))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin")));



CREATE POLICY "Users can view accessible images" ON "public"."generated_images" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "generated_images"."event_id") AND (("e"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin") OR (EXISTS ( SELECT 1
           FROM "public"."event_access" "ea"
          WHERE (("ea"."event_id" = "e"."id") AND ("ea"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))));



CREATE POLICY "Users can view credit ledger" ON "public"."credit_ledger" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin")));



CREATE POLICY "Users can view credits" ON "public"."user_credits" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin")));



CREATE POLICY "Users can view event pass addons" ON "public"."event_pass_addons" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."purchased_event_passes" "pep"
  WHERE (("pep"."id" = "event_pass_addons"."purchased_event_pass_id") AND (("pep"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin"))))));



CREATE POLICY "Users can view event prompts" ON "public"."event_prompts" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_prompts"."event_id") AND (("e"."is_active" = true) OR ("e"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin") OR (EXISTS ( SELECT 1
           FROM "public"."event_access" "ea"
          WHERE (("ea"."event_id" = "e"."id") AND ("ea"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))));



CREATE POLICY "Users can view own prompts and public prompts" ON "public"."prompts" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("is_public" = true) OR "public"."is_current_user_admin"()));



CREATE POLICY "Users can view own, shared, or all if admin" ON "public"."events" FOR SELECT TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR ("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."event_access"
  WHERE (("event_access"."event_id" = "events"."id") AND ("event_access"."user_id" = "auth"."uid"())))) OR "public"."is_current_user_admin"()));



CREATE POLICY "Users can view profiles" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin")));



CREATE POLICY "Users can view prompts" ON "public"."prompts" FOR SELECT TO "authenticated" USING ((("is_active" = true) AND (("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin") OR ("is_public" = true))));



CREATE POLICY "Users can view purchased passes" ON "public"."purchased_event_passes" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin")));



CREATE POLICY "Users can view subscriptions" ON "public"."user_subscriptions" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_is_admin"() AS "user_is_admin")));



CREATE POLICY "Users can view their granted access" ON "public"."event_access" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own customer data" ON "public"."stripe_customers" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view their own order data" ON "public"."stripe_orders" FOR SELECT TO "authenticated" USING ((("customer_id" IN ( SELECT "stripe_customers"."customer_id"
   FROM "public"."stripe_customers"
  WHERE (("stripe_customers"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("stripe_customers"."deleted_at" IS NULL)))) AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view their own subscription data" ON "public"."stripe_subscriptions" FOR SELECT TO "authenticated" USING ((("customer_id" IN ( SELECT "stripe_customers"."customer_id"
   FROM "public"."stripe_customers"
  WHERE (("stripe_customers"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("stripe_customers"."deleted_at" IS NULL)))) AND ("deleted_at" IS NULL)));



ALTER TABLE "public"."add_ons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_topup_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_pass_addons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_passes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."global_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchased_event_passes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smugmug_upload_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_tiers_new" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usage_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_add_on_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_credits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_event_passes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





























































































































































































GRANT ALL ON FUNCTION "public"."activate_pass"("p_pass_id" "uuid", "p_event_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."activate_pass"("p_pass_id" "uuid", "p_event_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."activate_pass"("p_pass_id" "uuid", "p_event_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_event_pass_credits"("p_user_id" "uuid", "p_credits" integer, "p_pass_id" "uuid", "p_stripe_payment_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_event_pass_credits"("p_user_id" "uuid", "p_credits" integer, "p_pass_id" "uuid", "p_stripe_payment_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_event_pass_credits"("p_user_id" "uuid", "p_credits" integer, "p_pass_id" "uuid", "p_stripe_payment_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_event_pass_sms_credits"("p_user_id" "uuid", "p_sms_credits" integer, "p_pass_id" "uuid", "p_stripe_payment_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_event_pass_sms_credits"("p_user_id" "uuid", "p_sms_credits" integer, "p_pass_id" "uuid", "p_stripe_payment_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_event_pass_sms_credits"("p_user_id" "uuid", "p_sms_credits" integer, "p_pass_id" "uuid", "p_stripe_payment_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_purchased_credits"("p_user_id" "uuid", "p_credits" integer, "p_stripe_session_id" "text", "p_stripe_payment_intent_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_purchased_credits"("p_user_id" "uuid", "p_credits" integer, "p_stripe_session_id" "text", "p_stripe_payment_intent_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_purchased_credits"("p_user_id" "uuid", "p_credits" integer, "p_stripe_session_id" "text", "p_stripe_payment_intent_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_purchased_sms_credits"("p_user_id" "uuid", "p_sms_credits" integer, "p_stripe_session_id" "text", "p_stripe_payment_intent_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_purchased_sms_credits"("p_user_id" "uuid", "p_sms_credits" integer, "p_stripe_session_id" "text", "p_stripe_payment_intent_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_purchased_sms_credits"("p_user_id" "uuid", "p_sms_credits" integer, "p_stripe_session_id" "text", "p_stripe_payment_intent_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_create_concurrent_event"("p_user_id" "uuid", "p_event_id" "uuid", "p_event_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_create_concurrent_event"("p_user_id" "uuid", "p_event_id" "uuid", "p_event_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_create_concurrent_event"("p_user_id" "uuid", "p_event_id" "uuid", "p_event_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_create_event"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_create_event"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_create_event"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_modify_event_start_time"("p_event_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_modify_event_start_time"("p_event_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_modify_event_start_time"("p_event_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_pass_validity"("p_pass_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_pass_validity"("p_pass_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_pass_validity"("p_pass_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_credit"("p_user_id" "uuid", "p_amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."consume_credit"("p_user_id" "uuid", "p_amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_credit"("p_user_id" "uuid", "p_amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_sms_credit"("p_user_id" "uuid", "p_amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."consume_sms_credit"("p_user_id" "uuid", "p_amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_sms_credit"("p_user_id" "uuid", "p_amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."count_user_active_events"("p_user_id" "uuid", "p_exclude_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_user_active_events"("p_user_id" "uuid", "p_exclude_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_user_active_events"("p_user_id" "uuid", "p_exclude_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."deactivate_expired_pass_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."deactivate_expired_pass_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."deactivate_expired_pass_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."duplicate_prompt"("source_prompt_id" "uuid", "new_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."duplicate_prompt"("source_prompt_id" "uuid", "new_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."duplicate_prompt"("source_prompt_id" "uuid", "new_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_passes"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_passes"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_passes"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pass_expiration"("p_pass_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pass_expiration"("p_pass_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pass_expiration"("p_pass_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_credits"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_credits"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_credits"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_sms_credits"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_sms_credits"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_sms_credits"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_concurrent_event_limit"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_concurrent_event_limit"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_concurrent_event_limit"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_credit_balance"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_credit_balance"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_credit_balance"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_event_credits"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_event_credits"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_event_credits"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_image_credits"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_image_credits"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_image_credits"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_subscription_info"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_subscription_info"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_subscription_info"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_subscription_type"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_subscription_type"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_subscription_type"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_activated_event_pass"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_activated_event_pass"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_activated_event_pass"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_active_subscription"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_active_subscription"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_active_subscription"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_image_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_image_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_image_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_image_usage"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_image_usage"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_image_usage"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_sms_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_sms_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_sms_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_sms_usage"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_sms_usage"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_sms_usage"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_user_image_usage"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_user_image_usage"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_user_image_usage"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_user_sms_usage"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_user_sms_usage"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_user_sms_usage"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_event_active_and_valid"("event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_event_active_and_valid"("event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_event_active_and_valid"("event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_pass_active"("p_pass_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_pass_active"("p_pass_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_pass_active"("p_pass_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_prompt_owner"("prompt_id" "uuid", "check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_prompt_owner"("prompt_id" "uuid", "check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_prompt_owner"("prompt_id" "uuid", "check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_start_time_change_with_activated_pass"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_start_time_change_with_activated_pass"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_start_time_change_with_activated_pass"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_global_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_global_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_global_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_webhook_events_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_webhook_events_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_webhook_events_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_role"("required_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_role"("required_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_role"("required_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_event_time_restrictions"("p_user_id" "uuid", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_pass_id" "uuid", "p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_event_time_restrictions"("p_user_id" "uuid", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_pass_id" "uuid", "p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_event_time_restrictions"("p_user_id" "uuid", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_pass_id" "uuid", "p_event_id" "uuid") TO "service_role";
























GRANT ALL ON TABLE "public"."add_ons" TO "anon";
GRANT ALL ON TABLE "public"."add_ons" TO "authenticated";
GRANT ALL ON TABLE "public"."add_ons" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."prompts" TO "anon";
GRANT ALL ON TABLE "public"."prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."prompts" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_tiers" TO "anon";
GRANT ALL ON TABLE "public"."subscription_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."user_credits" TO "anon";
GRANT ALL ON TABLE "public"."user_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_credits" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."admin_all_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_all_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_all_users" TO "service_role";



GRANT ALL ON TABLE "public"."credit_ledger" TO "anon";
GRANT ALL ON TABLE "public"."credit_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."credit_topup_products" TO "anon";
GRANT ALL ON TABLE "public"."credit_topup_products" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_topup_products" TO "service_role";



GRANT ALL ON TABLE "public"."credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."event_access" TO "anon";
GRANT ALL ON TABLE "public"."event_access" TO "authenticated";
GRANT ALL ON TABLE "public"."event_access" TO "service_role";



GRANT ALL ON TABLE "public"."event_pass_addons" TO "anon";
GRANT ALL ON TABLE "public"."event_pass_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."event_pass_addons" TO "service_role";



GRANT ALL ON TABLE "public"."event_passes" TO "anon";
GRANT ALL ON TABLE "public"."event_passes" TO "authenticated";
GRANT ALL ON TABLE "public"."event_passes" TO "service_role";



GRANT ALL ON TABLE "public"."event_prompts" TO "anon";
GRANT ALL ON TABLE "public"."event_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."event_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."generated_images" TO "anon";
GRANT ALL ON TABLE "public"."generated_images" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_images" TO "service_role";



GRANT ALL ON TABLE "public"."global_settings" TO "anon";
GRANT ALL ON TABLE "public"."global_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."global_settings" TO "service_role";



GRANT ALL ON TABLE "public"."purchased_event_passes" TO "anon";
GRANT ALL ON TABLE "public"."purchased_event_passes" TO "authenticated";
GRANT ALL ON TABLE "public"."purchased_event_passes" TO "service_role";



GRANT ALL ON TABLE "public"."sms_logs" TO "anon";
GRANT ALL ON TABLE "public"."sms_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_logs" TO "service_role";



GRANT ALL ON TABLE "public"."smugmug_upload_queue" TO "anon";
GRANT ALL ON TABLE "public"."smugmug_upload_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."smugmug_upload_queue" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_customers" TO "anon";
GRANT ALL ON TABLE "public"."stripe_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_customers" TO "service_role";




GRANT ALL ON SEQUENCE "public"."stripe_customers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stripe_customers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stripe_customers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_orders" TO "anon";
GRANT ALL ON TABLE "public"."stripe_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stripe_orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stripe_orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stripe_orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stripe_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stripe_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stripe_subscriptions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_user_orders" TO "anon";
GRANT ALL ON TABLE "public"."stripe_user_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_user_orders" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."stripe_user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_user_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_tiers_new" TO "anon";
GRANT ALL ON TABLE "public"."subscription_tiers_new" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_tiers_new" TO "service_role";



GRANT ALL ON TABLE "public"."usage_logs" TO "anon";
GRANT ALL ON TABLE "public"."usage_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_logs" TO "service_role";



GRANT ALL ON TABLE "public"."user_add_on_purchases" TO "anon";
GRANT ALL ON TABLE "public"."user_add_on_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."user_add_on_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."user_event_passes" TO "anon";
GRANT ALL ON TABLE "public"."user_event_passes" TO "authenticated";
GRANT ALL ON TABLE "public"."user_event_passes" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































