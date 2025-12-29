/*
  # Optimize Prompts RLS Performance with Cached Admin Check

  1. Problem
    - The current RLS policy on prompts table executes an EXISTS subquery to check admin status for EVERY row
    - This causes significant performance overhead when querying multiple prompts
    - Example: fetching 7 prompts results in 7+ admin checks instead of 1

  2. Solution
    - Create a STABLE helper function `is_current_user_admin()` that checks admin status once per query
    - PostgreSQL caches STABLE function results within a single query execution
    - Replace the EXISTS subquery in RLS policies with this cached function

  3. Performance Impact
    - Reduces admin role lookups from O(n) to O(1) per query
    - Significantly improves query performance for authenticated users
    - No change to security model - same access control logic

  4. Changes
    - Create `is_current_user_admin()` helper function
    - Update prompts SELECT policy to use the new function
    - Update prompts UPDATE policy to use the new function
    - Update prompts DELETE policy to use the new function
*/

-- Create a STABLE function to check if current user is admin (cached per query)
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
    AND lower(role) = 'admin'
  );
$$;

-- Drop existing policies that need optimization
DROP POLICY IF EXISTS "Users can view own prompts, public prompts, or all if admin" ON prompts;
DROP POLICY IF EXISTS "Users can update own prompts or admin can update all" ON prompts;
DROP POLICY IF EXISTS "Users can delete own prompts or admin can delete all" ON prompts;

-- Recreate policies with optimized admin check
CREATE POLICY "Users can view own prompts, public prompts, or all if admin"
  ON prompts
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_public = true
    OR is_current_user_admin()
  );

CREATE POLICY "Users can update own prompts or admin can update all"
  ON prompts
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_current_user_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR is_current_user_admin()
  );

CREATE POLICY "Users can delete own prompts or admin can delete all"
  ON prompts
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_current_user_admin()
  );
