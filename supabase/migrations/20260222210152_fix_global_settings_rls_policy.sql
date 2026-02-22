/*
  # Fix Global Settings RLS Policy Performance

  ## Overview
  This migration optimizes the RLS policy on the global_settings table by replacing
  direct auth function calls with subqueries. This prevents the auth function from
  being re-evaluated for each row, improving query performance.

  ## Changes Made
  
  1. **global_settings Table**
     - Updated "Admins can read all global settings" policy
     - Changed auth.uid() to (select auth.uid())
  
  ## Performance Impact
  By using a subquery, the auth function is evaluated once per query instead of
  once per row, significantly improving performance.
*/

-- Fix global_settings table SELECT policy
DROP POLICY IF EXISTS "Admins can read all global settings" ON global_settings;

CREATE POLICY "Admins can read all global settings"
  ON global_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );
