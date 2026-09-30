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
  2. Event-access holders (via event_prompts -> events -> event_access chain)
- SELECT policy unchanged.
- Original policies checked prompts.user_id = auth.uid() (prompt creator).
  Now also checks if the prompt's event (via event_prompts junction) is
  owned by the user, or the user is an admin, or the user has event_access.

## Security
- All write policies still require authentication (TO authenticated).
- No data is lost; only policy predicates change.

## Important Notes
1. This mirrors the fix already applied to event_device_usage.
2. The admin check uses user_profiles.role = 'admin'.
3. The event_access check uses the existing event_access table.
4. prompt_translations ownership is checked through event_prompts -> events.
*/

-- ============================================================
-- kiosk_text_overrides: fix INSERT/UPDATE/DELETE for admins + access holders
-- ============================================================

-- INSERT
DROP POLICY IF EXISTS "insert_kiosk_text_overrides" ON kiosk_text_overrides;
CREATE POLICY "insert_kiosk_text_overrides"
ON kiosk_text_overrides FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = kiosk_text_overrides.event_id
    AND (
      events.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
      OR EXISTS (SELECT 1 FROM event_access WHERE event_access.event_id = events.id AND event_access.user_id = auth.uid())
    )
  )
);

-- UPDATE
DROP POLICY IF EXISTS "update_kiosk_text_overrides" ON kiosk_text_overrides;
CREATE POLICY "update_kiosk_text_overrides"
ON kiosk_text_overrides FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = kiosk_text_overrides.event_id
    AND (
      events.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
      OR EXISTS (SELECT 1 FROM event_access WHERE event_access.event_id = events.id AND event_access.user_id = auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = kiosk_text_overrides.event_id
    AND (
      events.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
      OR EXISTS (SELECT 1 FROM event_access WHERE event_access.event_id = events.id AND event_access.user_id = auth.uid())
    )
  )
);

-- DELETE
DROP POLICY IF EXISTS "delete_kiosk_text_overrides" ON kiosk_text_overrides;
CREATE POLICY "delete_kiosk_text_overrides"
ON kiosk_text_overrides FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = kiosk_text_overrides.event_id
    AND (
      events.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
      OR EXISTS (SELECT 1 FROM event_access WHERE event_access.event_id = events.id AND event_access.user_id = auth.uid())
    )
  )
);

-- ============================================================
-- prompt_translations: fix INSERT/UPDATE/DELETE for admins + access holders
-- Ownership chain: prompt_translations -> prompts -> event_prompts -> events
-- ============================================================

-- INSERT
DROP POLICY IF EXISTS "insert_prompt_translations" ON prompt_translations;
CREATE POLICY "insert_prompt_translations"
ON prompt_translations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND (
      prompts.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM event_prompts ep
        JOIN events e ON e.id = ep.event_id
        WHERE ep.prompt_id = prompts.id
        AND (
          e.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
          OR EXISTS (SELECT 1 FROM event_access WHERE event_access.event_id = e.id AND event_access.user_id = auth.uid())
        )
      )
    )
  )
);

-- UPDATE
DROP POLICY IF EXISTS "update_prompt_translations" ON prompt_translations;
CREATE POLICY "update_prompt_translations"
ON prompt_translations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND (
      prompts.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM event_prompts ep
        JOIN events e ON e.id = ep.event_id
        WHERE ep.prompt_id = prompts.id
        AND (
          e.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
          OR EXISTS (SELECT 1 FROM event_access WHERE event_access.event_id = e.id AND event_access.user_id = auth.uid())
        )
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND (
      prompts.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM event_prompts ep
        JOIN events e ON e.id = ep.event_id
        WHERE ep.prompt_id = prompts.id
        AND (
          e.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
          OR EXISTS (SELECT 1 FROM event_access WHERE event_access.event_id = e.id AND event_access.user_id = auth.uid())
        )
      )
    )
  )
);

-- DELETE
DROP POLICY IF EXISTS "delete_prompt_translations" ON prompt_translations;
CREATE POLICY "delete_prompt_translations"
ON prompt_translations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM prompts
    WHERE prompts.id = prompt_translations.prompt_id
    AND (
      prompts.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM event_prompts ep
        JOIN events e ON e.id = ep.event_id
        WHERE ep.prompt_id = prompts.id
        AND (
          e.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
          OR EXISTS (SELECT 1 FROM event_access WHERE event_access.event_id = e.id AND event_access.user_id = auth.uid())
        )
      )
    )
  )
);