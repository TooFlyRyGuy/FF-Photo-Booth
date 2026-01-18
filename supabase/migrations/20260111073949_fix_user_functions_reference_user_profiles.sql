/*
  # Fix database functions to reference user_profiles instead of users

  1. Changes
    - Update `get_user_tenant_id()` function to reference user_profiles
    - Update `user_has_role()` function to reference user_profiles
    - Update `user_is_admin()` function to reference user_profiles
    
  2. Notes
    - These functions were incorrectly referencing a non-existent "users" table
    - The correct table is "user_profiles"
    - This was causing "relation 'users' does not exist" errors
*/

-- Fix get_user_tenant_id function
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT subscription_tier_id INTO v_tenant_id
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN v_tenant_id;
END;
$$;

-- Fix user_has_role function
CREATE OR REPLACE FUNCTION user_has_role(required_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
BEGIN
  SELECT role INTO v_user_role
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN v_user_role = required_role;
END;
$$;

-- Fix user_is_admin function
CREATE OR REPLACE FUNCTION user_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
BEGIN
  SELECT role INTO v_user_role
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN lower(v_user_role) = 'admin';
END;
$$;