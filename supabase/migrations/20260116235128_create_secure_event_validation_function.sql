/*
  # Create SECURITY DEFINER Function for Event Validation
  
  1. New Functions
    - `is_event_active_and_valid(event_id uuid)` - SECURITY DEFINER function
      - Bypasses RLS to reliably check if an event is active and within time window
      - Returns true if event exists, is_active=true, and within datetime restrictions
      - Used in generated_images RLS policies to prevent subquery issues
  
  2. Security
    - Function runs with elevated privileges to bypass RLS on events table
    - Only performs read operations, no data modification
    - Prevents infinite recursion in RLS policies
  
  3. Important Notes
    - This fixes authenticated users being unable to save generated images
    - Replaces subquery-based event validation in RLS policies
    - Improves performance by using a single function call
*/

-- Create SECURITY DEFINER function to check if event is active and valid
CREATE OR REPLACE FUNCTION is_event_active_and_valid(event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_record RECORD;
BEGIN
  -- Query with SECURITY DEFINER bypasses RLS
  SELECT 
    is_active,
    start_datetime,
    end_datetime
  INTO event_record
  FROM events
  WHERE id = event_id;
  
  -- If event not found, return false
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if event is active
  IF event_record.is_active = false THEN
    RETURN false;
  END IF;
  
  -- Check datetime restrictions if they exist
  IF event_record.start_datetime IS NOT NULL 
     AND NOW() < event_record.start_datetime THEN
    RETURN false;
  END IF;
  
  IF event_record.end_datetime IS NOT NULL 
     AND NOW() > event_record.end_datetime THEN
    RETURN false;
  END IF;
  
  -- Event is active and within valid time window
  RETURN true;
END;
$$;