/*
  # Fix is_event_active Function to Handle No Rows

  ## Overview
  Updates the is_event_active function to always return a boolean value,
  even when the event doesn't exist (returns FALSE).

  ## Changes
  1. Use COALESCE with a subquery to handle no-rows case
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
    SELECT 
      is_active 
      AND (
        start_datetime IS NULL 
        OR end_datetime IS NULL 
        OR (now() >= start_datetime AND now() <= end_datetime)
      )
    FROM events 
    WHERE id = event_uuid
  ),
  false
);
$function$;
