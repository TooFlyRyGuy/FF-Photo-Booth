/*
  # Optimize RLS Policies for Better Performance

  ## Overview
  This migration optimizes Row Level Security (RLS) policies by replacing direct calls to auth functions with subqueries.
  This prevents the auth functions from being re-evaluated for each row, significantly improving query performance at scale.

  ## Changes Made
  
  1. **Events Table Policies**
     - Updated "Users can update own events or admin can update all" policy
     - Updated "Users can view own, shared, or all if admin" policy
     - Changed auth.uid() to (select auth.uid())
  
  2. **Webhook Events Table Policies**
     - Updated "Admins can view all webhook events" policy
     - Changed auth.uid() to (select auth.uid())
  
  ## Performance Impact
  By using subqueries, auth functions are evaluated once per query instead of once per row,
  significantly improving performance on large tables.
*/

-- Fix events table UPDATE policy
DROP POLICY IF EXISTS "Users can update own events or admin can update all" ON events;

CREATE POLICY "Users can update own events or admin can update all"
  ON events
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- Fix events table SELECT policy
DROP POLICY IF EXISTS "Users can view own, shared, or all if admin" ON events;

CREATE POLICY "Users can view own, shared, or all if admin"
  ON events
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM event_access
      WHERE event_access.event_id = events.id
      AND event_access.user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- Fix webhook_events table SELECT policy
DROP POLICY IF EXISTS "Admins can view all webhook events" ON webhook_events;

CREATE POLICY "Admins can view all webhook events"
  ON webhook_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role = 'admin'
    )
  );
