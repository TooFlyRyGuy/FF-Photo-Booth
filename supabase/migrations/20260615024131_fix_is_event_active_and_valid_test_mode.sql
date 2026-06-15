CREATE OR REPLACE FUNCTION "public"."is_event_active_and_valid"("event_id" uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  event_record RECORD;
BEGIN
  SELECT
    is_active,
    start_datetime,
    end_datetime,
    test_mode
  INTO event_record
  FROM events
  WHERE id = event_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF event_record.is_active = false THEN
    RETURN false;
  END IF;

  -- In test mode, skip time-window checks
  IF event_record.test_mode = true THEN
    RETURN true;
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
