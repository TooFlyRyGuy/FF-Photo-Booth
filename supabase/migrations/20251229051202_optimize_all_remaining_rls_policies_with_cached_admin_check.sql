/*
  # Optimize Remaining RLS Policies with Cached Admin Check

  1. Problem
    - Multiple tables (events, global_settings) still use inefficient EXISTS subqueries
    - Each policy executes admin check for every row being evaluated
    - This causes performance degradation when querying multiple rows

  2. Solution
    - Use the existing `is_current_user_admin()` helper function
    - Replace all EXISTS subqueries with the cached function call
    - Maintains same security model with better performance

  3. Tables Updated
    - events: SELECT, UPDATE, DELETE policies
    - global_settings: SELECT, INSERT, UPDATE policies

  4. Performance Impact
    - Reduces admin role lookups from O(n) to O(1) per query
    - Consistent performance regardless of result set size
*/

-- EVENTS TABLE POLICIES
DROP POLICY IF EXISTS "Authenticated users can view own events, public events, or all " ON events;
DROP POLICY IF EXISTS "Users can update own events or admin can update all" ON events;
DROP POLICY IF EXISTS "Users can delete own events or admin can delete all" ON events;

CREATE POLICY "Authenticated users can view own events or all if admin"
  ON events
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_current_user_admin()
  );

CREATE POLICY "Users can update own events or admin can update all"
  ON events
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

CREATE POLICY "Users can delete own events or admin can delete all"
  ON events
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_current_user_admin()
  );

-- GLOBAL_SETTINGS TABLE POLICIES
DROP POLICY IF EXISTS "Admins can read global settings" ON global_settings;
DROP POLICY IF EXISTS "Admins can insert global settings" ON global_settings;
DROP POLICY IF EXISTS "Admins can update global settings" ON global_settings;

CREATE POLICY "Admins can read global settings"
  ON global_settings
  FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

CREATE POLICY "Admins can insert global settings"
  ON global_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update global settings"
  ON global_settings
  FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());
