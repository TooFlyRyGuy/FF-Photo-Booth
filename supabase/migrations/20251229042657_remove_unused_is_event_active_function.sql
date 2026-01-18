/*
  # Remove Unused is_event_active Function
  
  The is_event_active function is no longer needed since event date checks
  are now handled at the kiosk access level, not in RLS policies.
*/

-- Drop the function if it exists
DROP FUNCTION IF EXISTS is_event_active(uuid);
