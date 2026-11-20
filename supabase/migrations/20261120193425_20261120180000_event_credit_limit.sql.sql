/*
# Per-Event Credit Limit

Adds an optional credit limit per event. This is an ADDITIONAL cap on top of
the existing user credit system — photos still charge the event owner's balance
exactly as today. The event limit simply prevents further generations once the
event has consumed its configured number of credits.

1. New Columns on `events`
- `credit_limit` (integer, nullable, default null) — null means unlimited.
- `credits_used` (integer, NOT NULL, default 0) — running counter of credits
  consumed against this event's limit.

2. New Table: `event_credit_usage`
- Tracks individual credit reservations/consumptions/refunds per event.
- Columns: id (uuid PK), event_id (FK → events), reservation_id (uuid),
  amount (integer), status ('reserved' | 'consumed' | 'refunded'),
  created_at, completed_at.

3. Guard Trigger: `prevent_anon_event_credit_modification`
- Prevents non-admin users from directly updating `credit_limit` or
  `credits_used` on the `events` table. Anon kiosk users can still call
  the SECURITY DEFINER functions (get_event_credit_status,
  reserve_event_credits, finish_event_credit_reservation) to read and
  reserve credits, but cannot modify the limit or counter directly.

4. Functions (all SECURITY DEFINER)
- `get_event_credit_status(p_event_id uuid)` — returns credit_limit,
  credits_used, and remaining credits for an event.
- `reserve_event_credits(p_event_id uuid, p_amount int)` — atomically
  increments credits_used if under the limit, inserts a 'reserved' row
  into event_credit_usage, and returns the reservation_id. Returns NULL
  if the limit would be exceeded.
- `finish_event_credit_reservation(p_reservation_id uuid)` — marks a
  reservation as 'consumed'. Returns true on success.

5. RLS on `event_credit_usage`
- Anon + authenticated can INSERT and SELECT (kiosk needs to create
  reservations and read status).
- service_role has full access.
- No anon/authenticated UPDATE or DELETE — only the SECURITY DEFINER
  functions modify rows, running with elevated privileges.

6. Grants
- EXECUTE on all three functions granted to anon, authenticated.
- SELECT, INSERT on event_credit_usage granted to anon, authenticated.
- Full access on event_credit_usage granted to service_role.
*/

-- 1. Add columns to events table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'credit_limit') THEN
    ALTER TABLE events ADD COLUMN credit_limit integer DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'credits_used') THEN
    ALTER TABLE events ADD COLUMN credits_used integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Create event_credit_usage table
CREATE TABLE IF NOT EXISTS event_credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'consumed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE event_credit_usage ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies for event_credit_usage
DROP POLICY IF EXISTS "anon_select_event_credit_usage" ON event_credit_usage;
CREATE POLICY "anon_select_event_credit_usage"
  ON event_credit_usage FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_event_credit_usage" ON event_credit_usage;
CREATE POLICY "anon_insert_event_credit_usage"
  ON event_credit_usage FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 4. Grants for event_credit_usage
GRANT SELECT, INSERT ON event_credit_usage TO anon, authenticated;
GRANT ALL ON event_credit_usage TO service_role;

-- 5. Guard trigger: prevent non-admin users from modifying credit_limit or credits_used directly
CREATE OR REPLACE FUNCTION prevent_anon_event_credit_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Allow service_role and admins to modify these columns
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Check if the current user is an admin
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  -- Non-admin user is trying to modify credit_limit or credits_used
  IF NEW.credit_limit IS DISTINCT FROM OLD.credit_limit
     OR NEW.credits_used IS DISTINCT FROM OLD.credits_used THEN
    RAISE EXCEPTION 'Non-admin users cannot modify credit_limit or credits_used directly';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_anon_event_credit_modification ON events;
CREATE TRIGGER trg_prevent_anon_event_credit_modification
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_anon_event_credit_modification();

REVOKE EXECUTE ON FUNCTION prevent_anon_event_credit_modification() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prevent_anon_event_credit_modification() TO authenticated, service_role;

-- 6. get_event_credit_status function
CREATE OR REPLACE FUNCTION get_event_credit_status(p_event_id uuid)
RETURNS TABLE(credit_limit integer, credits_used integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit integer;
  v_used integer;
BEGIN
  SELECT e.credit_limit, e.credits_used
  INTO v_limit, v_used
  FROM events e
  WHERE e.id = p_event_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::integer, 0, NULL::integer;
    RETURN;
  END IF;

  IF v_limit IS NULL THEN
    RETURN QUERY SELECT NULL::integer, v_used, NULL::integer;
  ELSE
    RETURN QUERY SELECT v_limit, v_used, GREATEST(v_limit - v_used, 0);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_event_credit_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_event_credit_status(uuid) TO anon, authenticated, service_role;

-- 7. reserve_event_credits function
CREATE OR REPLACE FUNCTION reserve_event_credits(p_event_id uuid, p_amount integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit integer;
  v_used integer;
  v_reservation_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT e.credit_limit, e.credits_used
  INTO v_limit, v_used
  FROM events e
  WHERE e.id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- If no limit set, unlimited — always allow
  IF v_limit IS NULL THEN
    v_reservation_id := gen_random_uuid();
    INSERT INTO event_credit_usage (event_id, reservation_id, amount, status)
    VALUES (p_event_id, v_reservation_id, p_amount, 'reserved');
    RETURN v_reservation_id;
  END IF;

  -- Check if reservation would exceed the limit
  IF v_used + p_amount > v_limit THEN
    RETURN NULL;
  END IF;

  -- Atomically increment credits_used and create reservation
  UPDATE events SET credits_used = credits_used + p_amount WHERE id = p_event_id;

  v_reservation_id := gen_random_uuid();
  INSERT INTO event_credit_usage (event_id, reservation_id, amount, status)
  VALUES (p_event_id, v_reservation_id, p_amount, 'reserved');

  RETURN v_reservation_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION reserve_event_credits(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_event_credits(uuid, integer) TO anon, authenticated, service_role;

-- 8. finish_event_credit_reservation function
CREATE OR REPLACE FUNCTION finish_event_credit_reservation(p_reservation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE event_credit_usage
  SET status = 'consumed', completed_at = now()
  WHERE reservation_id = p_reservation_id AND status = 'reserved';

  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION finish_event_credit_reservation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finish_event_credit_reservation(uuid) TO anon, authenticated, service_role;