-- Fix SELECT policy: owners and admins can always see their event's prompts (not just active events)
DROP POLICY IF EXISTS "Anyone can view event prompts for active events" ON "public"."event_prompts";
DROP POLICY IF EXISTS "Users can view event prompts" ON "public"."event_prompts";
DROP POLICY IF EXISTS "Public can view event prompts for active events" ON "public"."event_prompts";

CREATE POLICY "Select event prompts" ON "public"."event_prompts"
  FOR SELECT TO "authenticated", "anon"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."events" e
      WHERE e.id = "event_prompts"."event_id"
        AND (
          e.is_active = true
          OR e.user_id = ( SELECT auth.uid())
          OR e.created_by = ( SELECT auth.uid())
          OR public.user_is_admin()
        )
    )
  );

-- Add UPDATE policy so upsert (INSERT ... ON CONFLICT DO UPDATE) works for admins
DROP POLICY IF EXISTS "Users can update event prompts for own events or admin" ON "public"."event_prompts";

CREATE POLICY "Users can update event prompts for own events or admin" ON "public"."event_prompts"
  FOR UPDATE TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."events"
      WHERE "events"."id" = "event_prompts"."event_id"
        AND ("events"."user_id" = ( SELECT auth.uid()) OR public.user_is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."events"
      WHERE "events"."id" = "event_prompts"."event_id"
        AND ("events"."user_id" = ( SELECT auth.uid()) OR public.user_is_admin())
    )
  );
