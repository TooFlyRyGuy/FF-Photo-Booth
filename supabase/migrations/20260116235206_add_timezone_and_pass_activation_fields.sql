/*
  # Add Timezone Support and Pass Activation Fields
  
  1. Schema Changes
    - Add `timezone` field to user_profiles table
      - Stores IANA timezone identifier (e.g., "America/New_York")
      - Default is 'UTC' for backward compatibility
      - Used for displaying all datetime values in user's local time
    
    - Add `activated_at` timestamp to user_event_passes table
      - Tracks when a pass was first used to create an event
      - NULL means pass is unused/available
      - Used to calculate pass expiration based on activation time
  
  2. Data Migration
    - Set existing user profiles to UTC timezone
    - Existing passes remain NULL for activated_at (unused)
  
  3. Important Notes
    - Timezone should be updated by client on signup/login
    - Pass activation happens when user creates an event with the pass
    - Pass expiration is calculated from activated_at + duration_hours
*/

-- Add timezone field to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN timezone text DEFAULT 'UTC' NOT NULL;
  END IF;
END $$;

-- Add activated_at field to user_event_passes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_event_passes' AND column_name = 'activated_at'
  ) THEN
    ALTER TABLE user_event_passes
    ADD COLUMN activated_at timestamptz;
  END IF;
END $$;

-- Add event_id field to user_event_passes to track which event used the pass
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_event_passes' AND column_name = 'event_id'
  ) THEN
    ALTER TABLE user_event_passes
    ADD COLUMN event_id uuid REFERENCES events(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for activated_at queries
CREATE INDEX IF NOT EXISTS idx_user_event_passes_activated_at 
  ON user_event_passes(activated_at);

-- Add index for event_id lookups
CREATE INDEX IF NOT EXISTS idx_user_event_passes_event_id 
  ON user_event_passes(event_id);