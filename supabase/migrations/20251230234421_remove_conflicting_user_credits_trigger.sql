/*
  # Remove Conflicting User Credits Initialization Trigger
  
  ## Problem
  There is a conflicting trigger `on_user_profile_created_init_credits` that runs 
  AFTER INSERT on user_profiles. It calls `initialize_user_credits()` which tries 
  to insert into user_credits with columns `available_credits` and `rollover_credits` 
  that NO LONGER EXIST in the schema.
  
  The current user_credits schema has:
  - images_limit, images_used
  - sms_limit, sms_used
  - events_limit
  - reset_date
  
  This old trigger is causing the "Database error saving new user" error because
  it tries to insert non-existent columns after user_profiles is created.
  
  ## Solution
  Drop the old trigger and function completely. The `handle_new_user()` trigger on
  auth.users already handles creating both user_profiles AND user_credits with the
  correct schema.
  
  ## Changes
  - Drop `on_user_profile_created_init_credits` trigger
  - Drop `initialize_user_credits()` function
*/

-- Drop the conflicting trigger
DROP TRIGGER IF EXISTS on_user_profile_created_init_credits ON user_profiles;

-- Drop the old function
DROP FUNCTION IF EXISTS public.initialize_user_credits() CASCADE;
