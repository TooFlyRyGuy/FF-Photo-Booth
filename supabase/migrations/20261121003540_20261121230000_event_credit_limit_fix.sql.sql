/*
# Event credit limit fix
Fixes the per-event credit limit added in 20261120193425 (event_credit_limit):
1. Guard trigger `prevent_anon_event_credit_modification`
   - The kiosk (anon, or a signed-in non-admin owner) calls reserve_event_credits.
     SECURITY DEFINER does not change the `role` setting or auth.uid(), so the old
     guard raised inside reserve_event_credits and every photo showed "limit reached".
   - Now: the credit functions mark themselves with a transaction-local flag
     (app.event_credit_fn) and the guard lets them through. The event owner
     (events.user_id = auth.uid()) and admins may set credit_limit (NULL or >= 0)
     and reset credits_used to 0. Everyone else using the API roles is blocked.
     Direct database sessions (service_role, SQL editor, migrations) are unaffected.
2. Refunds
   - finish_event_credit_reservation(p_reservation_id uuid, p_success boolean default true)
     replaces the one-argument version. Success -> 'consumed'. Failure -> the amount is
     given back to events.credits_used once and the row is marked 'refunded'.
     Reservations older than 15 minutes are marked 'consumed' and not refunded.
   - New column event_credit_usage.counted records whether the reservation actually
     added to credits_used (false for events with no limit), so a refund never
     subtracts credits that were never counted.
3. event_credit_usage access
   - Only the SECURITY DEFINER functions write. anon gets no access; signed-in users
     can only read rows for events they own, or all rows if admin.
4. search_path pinned on all four functions.
*/
-- 0. Table additions
ALTER TABLE public.event_credit_usage
  ADD COLUMN IF NOT EXISTS counted boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS event_credit_usage_reservation_id_key
  ON public.event_credit_usage (reservation_id);
CREATE INDEX IF NOT EXISTS event_credit_usage_event_id_idx
  ON public.event_credit_usage (event_id);
-- 1. Guard trigger
CREATE OR REPLACE FUNCTION public.prevent_anon_event_credit_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.credit_limit IS NOT DISTINCT FROM OLD.credit_limit
     AND NEW.credits_used IS NOT DISTINCT FROM OLD.credits_used THEN
    RETURN NEW;
  END IF;
  -- reserve_event_credits / finish_event_credit_reservation
  IF current_setting('app.event_credit_fn', true) = 'on' THEN
    RETURN NEW;
  END IF;
  -- service_role, SQL editor, migrations (not the browser API roles)
  IF COALESCE(current_setting('role', true), 'none') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF v_uid IS NULL OR NOT (OLD.user_id = v_uid OR public.is_admin(v_uid)) THEN
    RAISE EXCEPTION 'Only the event owner or an admin can change the event credit limit';
  END IF;
  IF NEW.credit_limit IS NOT NULL AND NEW.credit_limit < 0 THEN
    RAISE EXCEPTION 'Event credit limit must be empty or 0 or more';
  END IF;
  IF NEW.credits_used IS DISTINCT FROM OLD.credits_used AND NEW.credits_used <> 0 THEN
    RAISE EXCEPTION 'Event credits used can only be reset to 0';
  END IF;
  RETURN NEW;
END;
$$;
-- 2. Status (unchanged logic, pinned search_path)
ALTER FUNCTION public.get_event_credit_status(uuid) SET search_path = public, pg_temp;
-- 3. Reserve
CREATE OR REPLACE FUNCTION public.reserve_event_credits(p_event_id uuid, p_amount integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer;
  v_used integer;
  v_reservation_id uuid := gen_random_uuid();
BEGIN
  IF p_event_id IS NULL OR p_amount IS NULL OR p_amount < 1 OR p_amount > 4 THEN
    RETURN NULL;
  END IF;
  SELECT e.credit_limit, e.credits_used INTO v_limit, v_used
  FROM public.events e
  WHERE e.id = p_event_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_limit IS NOT NULL THEN
    IF v_used + p_amount > v_limit THEN
      RETURN NULL;
    END IF;
    PERFORM set_config('app.event_credit_fn', 'on', true);
    UPDATE public.events SET credits_used = credits_used + p_amount WHERE id = p_event_id;
    PERFORM set_config('app.event_credit_fn', 'off', true);
  END IF;
  INSERT INTO public.event_credit_usage (event_id, reservation_id, amount, status, counted)
  VALUES (p_event_id, v_reservation_id, p_amount, 'reserved', v_limit IS NOT NULL);
  RETURN v_reservation_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reserve_event_credits(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_event_credits(uuid, integer) TO anon, authenticated, service_role;
-- 4. Finish: consume on success, refund once on failure
DROP FUNCTION IF EXISTS public.finish_event_credit_reservation(uuid);
CREATE OR REPLACE FUNCTION public.finish_event_credit_reservation(
  p_reservation_id uuid,
  p_success boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row_id uuid;
  v_event_id uuid;
  v_amount integer;
  v_counted boolean;
  v_created timestamptz;
BEGIN
  IF p_reservation_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT u.event_id INTO v_event_id
  FROM public.event_credit_usage u
  WHERE u.reservation_id = p_reservation_id AND u.status = 'reserved';
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  -- Same lock order as reserve_event_credits: event row, then usage row.
  PERFORM 1 FROM public.events WHERE id = v_event_id FOR UPDATE;
  SELECT u.id, u.amount, u.counted, u.created_at
  INTO v_row_id, v_amount, v_counted, v_created
  FROM public.event_credit_usage u
  WHERE u.reservation_id = p_reservation_id AND u.status = 'reserved'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF COALESCE(p_success, true) OR v_created < now() - interval '15 minutes' THEN
    UPDATE public.event_credit_usage
    SET status = 'consumed', completed_at = now()
    WHERE id = v_row_id;
    RETURN true;
  END IF;
  IF v_counted THEN
    PERFORM set_config('app.event_credit_fn', 'on', true);
    UPDATE public.events
    SET credits_used = GREATEST(credits_used - v_amount, 0)
    WHERE id = v_event_id;
    PERFORM set_config('app.event_credit_fn', 'off', true);
  END IF;
  UPDATE public.event_credit_usage
  SET status = 'refunded', completed_at = now()
  WHERE id = v_row_id;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.finish_event_credit_reservation(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_event_credit_reservation(uuid, boolean) TO anon, authenticated, service_role;
-- 5. event_credit_usage: functions write, owner/admin read
DROP POLICY IF EXISTS "anon_insert_event_credit_usage" ON public.event_credit_usage;
DROP POLICY IF EXISTS "anon_select_event_credit_usage" ON public.event_credit_usage;
DROP POLICY IF EXISTS "owner_or_admin_select_event_credit_usage" ON public.event_credit_usage;
REVOKE ALL ON public.event_credit_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_credit_usage TO authenticated;
GRANT ALL ON public.event_credit_usage TO service_role;
CREATE POLICY "owner_or_admin_select_event_credit_usage"
  ON public.event_credit_usage FOR SELECT
  TO authenticated
  USING (
    public.is_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_credit_usage.event_id
        AND e.user_id = (SELECT auth.uid())
    )
  );