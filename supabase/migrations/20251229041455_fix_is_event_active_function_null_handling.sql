/*
  # Fix is_event_active Function NULL Handling

  ## Overview
  Updates the is_event_active function to return FALSE instead of NULL
  when an event doesn't exist. This prevents RLS policy failures.

  ## Changes
  1. Add COALESCE to handle NULL cases
  2. Return FALSE when event not found

  ## Security
  - Maintains SECURITY DEFINER to bypass RLS when checking event status
  - Ensures anonymous users can check if events are active
*/

CREATE OR REPLACE FUNCTION public.is_event_active(event_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
SELECT COALESCE(
  (
    is_active 
    AND (
      start_datetime IS NULL 
      OR end_datetime IS NULL 
      OR (now() >= start_datetime AND now() <= end_datetime)
    )
  ),
  false
) as result
FROM events 
WHERE id = event_uuid;
$function$;
