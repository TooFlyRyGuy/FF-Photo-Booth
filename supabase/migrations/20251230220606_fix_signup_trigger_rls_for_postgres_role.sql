/*
  # Fix Signup Trigger RLS for Postgres Role
  
  ## Problem
  The handle_new_user() trigger function runs as SECURITY DEFINER with owner=postgres.
  However, RLS policies for INSERT on user_profiles and user_credits only allow
  authenticated and anon roles. When the function executes as postgres role, the
  RLS policies block the inserts, causing signup to fail.
  
  ## Solution
  Update the INSERT policies to also allow the postgres role (superuser) to insert.
  This allows the SECURITY DEFINER trigger function to successfully create user
  records during signup.
  
  ## Security
  - Only affects the postgres superuser role
  - Function is SECURITY DEFINER and only called by auth.users trigger
  - Users cannot directly invoke this function to bypass security
  - RLS remains enabled for all user-facing operations
*/

-- Drop and recreate the user_profiles INSERT policy to include postgres role
DROP POLICY IF EXISTS "System can insert user profiles" ON user_profiles;
CREATE POLICY "System can insert user profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated, anon, postgres
  WITH CHECK (true);

-- Drop and recreate the user_credits INSERT policy to include postgres role
DROP POLICY IF EXISTS "System can insert credits" ON user_credits;
CREATE POLICY "System can insert credits"
  ON user_credits
  FOR INSERT
  TO authenticated, anon, postgres
  WITH CHECK (true);
