/*
  # Fix Infinite Recursion in RLS Policies

  ## Problem
  Circular dependency between tenants and events tables causing infinite recursion:
  - tenants policy checks if events exist
  - event_prompts policy checks events
  - events query checks tenants
  - This creates an infinite loop

  ## Solution
  Simplify the tenants SELECT policy to only check:
  1. Demo tenant access
  2. User's own tenant (via users table)
  
  Remove the events existence check that was causing the circular dependency.

  ## Changes
  1. Drop and recreate tenants SELECT policy without events check
*/

-- =====================================================
-- FIX TENANTS TABLE RLS POLICY
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view demo tenant or tenants with active events" ON tenants;

CREATE POLICY "Anyone can view demo tenant or own tenant"
  ON tenants FOR SELECT
  TO public
  USING (
    id = '00000000-0000-0000-0000-000000000001'::uuid
    OR ((select auth.uid()) IS NOT NULL AND id IN (
      SELECT tenant_id FROM users WHERE id = (select auth.uid())
    ))
  );
