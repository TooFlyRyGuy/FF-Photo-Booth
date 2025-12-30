/*
  # Fix Infinite Recursion in User Profiles Policies

  1. Problem
    - The admin policies added in previous migration cause infinite recursion
    - They check user_profiles to determine if user is admin, which triggers RLS again
    - This creates an infinite loop when querying user_profiles

  2. Solution
    - Use the existing `is_current_user_admin()` SECURITY DEFINER function
    - This function bypasses RLS when checking admin status, preventing recursion
    - Update all user_profiles and user_credits policies to use this cached function

  3. Changes
    - Drop problematic policies that cause recursion
    - Recreate policies using `is_current_user_admin()` function
    - Ensures admins can view and manage all users without recursion
*/

-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all user credits" ON user_credits;
DROP POLICY IF EXISTS "Admins can update all user credits" ON user_credits;

-- Recreate user_profiles policies with cached admin check
CREATE POLICY "Admins can view all user profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

CREATE POLICY "Admins can update all user profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Recreate user_credits policies with cached admin check
CREATE POLICY "Admins can view all user credits"
  ON user_credits FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

CREATE POLICY "Admins can update all user credits"
  ON user_credits FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());