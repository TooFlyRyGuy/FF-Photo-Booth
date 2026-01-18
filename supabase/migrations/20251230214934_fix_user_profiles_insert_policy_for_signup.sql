/*
  # Add INSERT Policy for user_profiles Table
  
  ## Problem
  The handle_new_user() trigger fails because user_profiles table has no INSERT policy.
  Even though the function uses SECURITY DEFINER, we need proper RLS policies for the table.
  
  ## Changes
  1. Add INSERT policy to allow the signup system to create new user profiles
  2. Policy allows authenticated users to insert their own profile during signup
  
  ## Security
  - Only allows users to insert their own profile (id = auth.uid())
  - Restrictive to prevent unauthorized profile creation
*/

-- Add INSERT policy for user_profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND policyname = 'System can insert user profiles'
  ) THEN
    CREATE POLICY "System can insert user profiles"
      ON user_profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (id = auth.uid());
  END IF;
END $$;
