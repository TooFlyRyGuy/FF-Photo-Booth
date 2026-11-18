/*
# Add is_admin(uuid) overload

## Problem
`prevent_start_time_change_with_activated_pass()` and
`can_modify_event_start_time(p_event_id, p_user_id)` call `is_admin(uuid)`.
Only the no-arg `is_admin()` exists, so Admin Save Event fails with
`function is_admin(uuid) does not exist` whenever start_datetime changes.

## Changes
- Adds `is_admin(uuid)` that is true when `user_profiles.role` is admin for
  the given user id.
- Does not drop or replace the no-arg `is_admin()`.

## Apply
Idempotent (`CREATE OR REPLACE`, plus revoke/grant). Safe to run twice.
Apply this migration to the Supabase project; it is not applied automatically
by this pull request.
*/

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id AND lower(role) = 'admin');
END; $$;
COMMENT ON FUNCTION public.is_admin(uuid) IS 'True if the given user_profiles.id has role admin. Used by prevent_start_time_change_with_activated_pass and can_modify_event_start_time.';
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
