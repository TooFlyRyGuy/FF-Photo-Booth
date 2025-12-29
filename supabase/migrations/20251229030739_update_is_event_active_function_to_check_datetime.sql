/*
  # Update is_event_active Function to Check Date/Time Range

  ## Problem
  The `is_event_active` function only checks the `is_active` boolean flag but doesn't consider the `start_datetime` and `end_datetime` fields. This causes events to show as active even when they haven't started yet or have already ended.

  ## Changes
  - Update the `is_event_active` function to check if the current time is within the event's date/time range
  - Event is considered active only if:
    1. `is_active` is true
    2. If `start_datetime` and `end_datetime` are set, current time must be between them

  ## Impact
  - Events will now automatically become inactive before their start time and after their end time
  - Improves kiosk access control by preventing access to events that haven't started or have ended
  - Admin dashboard and event listings will show accurate active status
*/

-- Update the is_event_active function to check datetime range
CREATE OR REPLACE FUNCTION is_event_active(event_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    is_active 
    AND (
      start_datetime IS NULL 
      OR end_datetime IS NULL 
      OR (now() >= start_datetime AND now() <= end_datetime)
    )
  FROM events 
  WHERE id = event_uuid;
$$;
