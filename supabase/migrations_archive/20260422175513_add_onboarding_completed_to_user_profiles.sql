/*
  # Add onboarding_completed flag to user_profiles

  1. Modified Tables
    - `user_profiles`
      - Added `onboarding_completed` (boolean, default false) - tracks whether user has completed the new user tutorial

  2. Notes
    - Existing users get false by default but will not see tutorial since it only triggers for inactive/trial accounts with no events
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN onboarding_completed boolean DEFAULT false;
  END IF;
END $$;
