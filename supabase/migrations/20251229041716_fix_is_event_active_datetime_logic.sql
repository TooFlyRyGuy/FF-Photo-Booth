/*
  Fix is_event_active Function DateTime Logic
  
  Fixes the datetime checking logic to properly handle start and end times.
  Previous logic used OR which made events active if EITHER date was NULL.
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
      AND (start_datetime IS NULL OR now() >= start_datetime)
      AND (end_datetime IS NULL OR now() <= end_datetime)
    FROM events 
    WHERE id = event_uuid
  ),
  false
);
$function$;
