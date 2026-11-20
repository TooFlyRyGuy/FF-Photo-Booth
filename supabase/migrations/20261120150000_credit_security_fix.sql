-- Credit security fix.
-- 1) Credit-granting and usage-counter functions were executable by PUBLIC (anyone with the anon key
--    could add credits to any account). Only server code (Stripe webhook, service role) calls them.
-- 2) consume_credit: lock the balance row, never partially drain, cap the amount, write a ledger row.
--    The kiosk (anon) and Prompt Library (signed in) still call it, so it stays callable by them.
-- 3) user_credits: users can no longer UPDATE their own balance (admins only); self-insert only an empty row.
-- No tables, columns or data are changed.

-- 1. Server-only functions
REVOKE EXECUTE ON FUNCTION public.add_purchased_credits(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_purchased_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_purchased_sms_credits(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_purchased_sms_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_event_pass_credits(uuid, integer, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_event_pass_sms_credits(uuid, integer, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_image_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_sms_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_user_image_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_user_sms_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_sms_credit(uuid, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.add_purchased_credits(uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_purchased_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_purchased_sms_credits(uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_purchased_sms_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_event_pass_credits(uuid, integer, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_event_pass_sms_credits(uuid, integer, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_image_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_sms_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_user_image_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_user_sms_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_sms_credit(uuid, integer) TO service_role;

-- 2. Safe consume_credit (same signature and return type as before)
CREATE OR REPLACE FUNCTION public.consume_credit(p_user_id uuid, p_amount integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_event integer;
  v_sub integer;
  v_pur integer;
  v_take_event integer;
  v_take_sub integer;
  v_take_pur integer;
  v_left integer;
BEGIN
  -- Booth photos cost 1, 2 or 4 credits (1K / 2K / 4K).
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount < 1 OR p_amount > 4 THEN
    RETURN false;
  END IF;

  SELECT GREATEST(COALESCE(event_credits, 0), 0),
         GREATEST(COALESCE(subscription_credits, 0), 0),
         GREATEST(COALESCE(purchased_credits, 0), 0)
    INTO v_event, v_sub, v_pur
    FROM public.user_credits
   WHERE user_id = p_user_id
   FOR UPDATE;

  -- Not enough in total: change nothing (no partial drain).
  IF NOT FOUND OR v_event + v_sub + v_pur < p_amount THEN
    RETURN false;
  END IF;

  v_left := p_amount;
  v_take_event := LEAST(v_event, v_left);  v_left := v_left - v_take_event;
  v_take_sub   := LEAST(v_sub, v_left);    v_left := v_left - v_take_sub;
  v_take_pur   := v_left;

  UPDATE public.user_credits
     SET event_credits = v_event - v_take_event,
         subscription_credits = v_sub - v_take_sub,
         purchased_credits = v_pur - v_take_pur,
         updated_at = now()
   WHERE user_id = p_user_id;

  INSERT INTO public.credit_ledger (user_id, source, amount, balance_after, metadata)
  VALUES (p_user_id, 'consumption', -p_amount, v_event + v_sub + v_pur - p_amount,
          jsonb_build_object('from_event', v_take_event, 'from_subscription', v_take_sub, 'from_purchased', v_take_pur));

  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_credit(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_credit(uuid, integer) TO anon, authenticated, service_role;

-- 3. user_credits / credit_ledger access
DROP POLICY IF EXISTS "Users can update credits" ON public.user_credits;
DROP POLICY IF EXISTS "Admins can update credits" ON public.user_credits;
CREATE POLICY "Admins can update credits" ON public.user_credits
  FOR UPDATE TO authenticated
  USING ((SELECT public.user_is_admin()))
  WITH CHECK ((SELECT public.user_is_admin()));

DROP POLICY IF EXISTS "System can create credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can create own empty credits row" ON public.user_credits;
CREATE POLICY "Users can create own empty credits row" ON public.user_credits
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.user_is_admin())
    OR (
      user_id = (SELECT auth.uid())
      AND COALESCE(subscription_credits, 0) = 0
      AND COALESCE(purchased_credits, 0) = 0
      AND COALESCE(event_credits, 0) = 0
      AND COALESCE(subscription_sms_credits, 0) = 0
      AND COALESCE(purchased_sms_credits, 0) = 0
      AND COALESCE(event_sms_credits, 0) = 0
    )
  );

-- anon never reads these tables directly (the kiosk uses get_user_credit_balance), and TRUNCATE skips RLS.
REVOKE ALL ON public.user_credits FROM anon;
REVOKE ALL ON public.credit_ledger FROM anon;
REVOKE DELETE, TRUNCATE ON public.user_credits FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.credit_ledger FROM authenticated;
