/*
# Revoke anon execute on transfer_event_ownership

## Summary
The security advisor flagged that `transfer_event_ownership` is callable by
the `anon` role. By default, new functions grant EXECUTE to PUBLIC. We only
want authenticated users (the event owner or admin) to call this function.

## Changes
- Revoke EXECUTE on `transfer_event_ownership` from `anon` and `PUBLIC`.
- Keep EXECUTE granted to `authenticated` (already done in prior migration).
*/

REVOKE EXECUTE ON FUNCTION public.transfer_event_ownership(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_event_ownership(uuid, uuid) TO authenticated;
