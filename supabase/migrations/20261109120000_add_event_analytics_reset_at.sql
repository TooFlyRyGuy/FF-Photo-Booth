/*
# Per-event documentation statistics baseline

Event analytics (photo totals, theme popularity, the 30-day chart, and the
phone-number report) are counted from `generated_images` rows for that event.
FunFrame displays and guest galleries also read those rows, and an insert
trigger increments billing usage (`user_credits.images_used`) plus the
denormalized counters `events.total_generations` and `prompts.usage_count`.

This migration adds a nullable baseline on one event. Analytics queries count
only `generated_images.created_at` values after `events.analytics_reset_at`.
Nothing is deleted. Billing tables, credit balances, SMS logs, storage files,
prompts, device photo limits, and every other event stay unchanged.

## Apply (Fun, production)

Run this file in the Supabase SQL editor or with the Supabase CLI against the
project. Do it before the app version that selects `analytics_reset_at` is
deployed. This file is additive. It does not write row data.

## What an admin clear does

`clear_event_documentation_stats(event_id)` sets `analytics_reset_at = now()`
on that single event. Only an authenticated admin can call it, and a trigger
rejects any other update of the column (including an event owner saving the
event). `authenticated` has table-level UPDATE on `events`, so a column-level
REVOKE is not sufficient by itself. The trigger is the enforcement.
*/

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS analytics_reset_at timestamptz;

COMMENT ON COLUMN public.events.analytics_reset_at IS
  'Documentation baseline for this event only. Analytics count generations created after this time. NULL counts every generation. Photos, displays, and billing are not affected.';

CREATE OR REPLACE FUNCTION public.protect_event_analytics_reset_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.analytics_reset_at IS DISTINCT FROM OLD.analytics_reset_at THEN
    IF auth.uid() IS NULL OR NOT public.user_is_admin() THEN
      RAISE EXCEPTION 'Only an admin can clear event documentation statistics';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_event_analytics_reset_at ON public.events;

CREATE TRIGGER protect_event_analytics_reset_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_event_analytics_reset_at();

COMMENT ON FUNCTION public.protect_event_analytics_reset_at() IS
  'Rejects changes to events.analytics_reset_at unless the session user is an admin.';

CREATE OR REPLACE FUNCTION public.clear_event_documentation_stats(p_event_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_is_admin() THEN
    RAISE EXCEPTION 'Only an admin can clear event documentation statistics';
  END IF;

  UPDATE public.events
  SET analytics_reset_at = now()
  WHERE id = p_event_id
  RETURNING analytics_reset_at INTO v_reset_at;

  IF v_reset_at IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  RETURN v_reset_at;
END;
$$;

COMMENT ON FUNCTION public.clear_event_documentation_stats(uuid) IS
  'Admin-only. Sets analytics_reset_at on one event so documented stats ignore earlier generations. Does not delete rows or change credits.';

REVOKE ALL ON FUNCTION public.clear_event_documentation_stats(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clear_event_documentation_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.clear_event_documentation_stats(uuid) TO authenticated;

-- protect_event_analytics_reset_at stays executable. It runs on every events
-- update, including an owner saving a name or date. Revoking it would block
-- those saves with "permission denied for function".

-- Column privilege is defense in depth. Table-level UPDATE still exists for
-- event owners, so protect_event_analytics_reset_at is what actually blocks them.
REVOKE UPDATE (analytics_reset_at) ON public.events FROM anon, authenticated;
