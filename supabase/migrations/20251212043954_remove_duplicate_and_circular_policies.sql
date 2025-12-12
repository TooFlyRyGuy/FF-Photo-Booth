/*
  # Remove Duplicate and Circular RLS Policies

  ## Problem
  Multiple issues causing infinite recursion:
  1. Duplicate policies on events table (two INSERT, two UPDATE policies)
  2. Circular dependency: events->tenants->users->events
  3. "Users can view own events" policy checks tenants which checks users

  ## Solution
  1. Remove all duplicate policies
  2. Remove policies that create circular dependencies
  3. Keep only the simple, direct policies using tenant_id or user_id

  ## Changes
  - Remove duplicate events policies that use users table
  - Remove events policies that check tenants table
  - Keep simple policies using direct relationships
*/

-- =====================================================
-- REMOVE DUPLICATE AND CIRCULAR POLICIES ON EVENTS
-- =====================================================

-- Remove the policies that create circular dependency (events -> tenants)
DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Users can insert own events" ON events;
DROP POLICY IF EXISTS "Users can update own events" ON events;
DROP POLICY IF EXISTS "Users can delete own events" ON events;

-- Keep the simple policies that don't create circular dependencies
-- (These are already in place from previous migrations)
