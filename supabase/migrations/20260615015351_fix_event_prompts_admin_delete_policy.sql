-- Allow admins to delete event_prompts for any event (not just their own)
DROP POLICY IF EXISTS "Users can delete event prompts for own events" ON "public"."event_prompts";

CREATE POLICY "Users can delete event prompts for own events or admin" ON "public"."event_prompts"
  FOR DELETE TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."events"
      WHERE "events"."id" = "event_prompts"."event_id"
        AND ("events"."user_id" = ( SELECT auth.uid()) OR public.user_is_admin())
    )
  );

-- Also allow admins to insert event_prompts for any event
DROP POLICY IF EXISTS "Users can insert event prompts for own events" ON "public"."event_prompts";

CREATE POLICY "Users can insert event prompts for own events or admin" ON "public"."event_prompts"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."events"
      WHERE "events"."id" = "event_prompts"."event_id"
        AND ("events"."user_id" = ( SELECT auth.uid()) OR public.user_is_admin())
    )
  );
