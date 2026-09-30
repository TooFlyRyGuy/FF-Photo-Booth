/*
# Fix Language Settings RLS for Admins and Event-Access Holders

## Problem
The kiosk_text_overrides and prompt_translations tables have RLS policies
that only allow the original event owner (events.user_id = auth.uid()) to
INSERT, UPDATE, and DELETE. Admins and users granted event access via the
event_access table cannot save language settings, causing a silent RLS
rejection and an error in the Language Settings modal.

## Changes

### kiosk_text_overrides
- INSERT, UPDATE, DELETE policies expanded to also allow:
  1. Admins (user_profiles.role = 'admin')
  2. Event-access holders (event_access table match on event_id + user_id)
- SELECT policy unchanged (already allows anon + owner).

### prompt_translations
- INSERT, UPDATE, DELETE policies expanded to also allow:
  1. Admins (user_profiles.role = 'admin')
  2. Event-access holders (via event_access -> events -> prompts chain)
- SELECT policy unchanged.

## Security
- All write policies still require authentication (TO authenticated).
- Ownership is verified through the events table, now with an OR branch
  for admin role and event_access membership.
- No data is lost; only policy predicates change.

## Important Notes
1. This mirrors the fix already applied to event_device_usage.
2. The admin check uses user_profiles.role = 'admin'.
3. The event_access check uses the existing event_access table.
4. prompt_translations ownership is checked through prompts -> events.
*/