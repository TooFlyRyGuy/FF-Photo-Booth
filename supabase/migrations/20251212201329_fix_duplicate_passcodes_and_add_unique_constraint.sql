/*
  # Fix Duplicate Passcodes and Add Unique Constraint

  1. Changes
    - Update demo tenant event passcode from '0524' to 'DEMO' to avoid conflicts
    - Add unique constraint on passcode field to prevent future duplicates
  
  2. Security
    - Ensures each event has a unique passcode for reliable access
    - Prevents confusion and errors when accessing kiosk mode
*/

-- Update the demo tenant event to have a unique passcode
UPDATE events 
SET passcode = 'DEMO'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001' 
  AND passcode = '0524';

-- Add unique constraint to passcode field
ALTER TABLE events 
ADD CONSTRAINT events_passcode_unique UNIQUE (passcode);
