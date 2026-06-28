-- Grant SELECT to supabase_admin so autovacuum can analyze these RLS-enabled tables.
-- Without this, the autovacuum worker emits "permission denied to analyze, skipping it"
-- and query planner statistics stay permanently stale.
GRANT SELECT ON public.library_submissions TO supabase_admin;
GRANT SELECT ON public.smugmug_upload_queue TO supabase_admin;

-- Immediately refresh statistics so the planner has current data now.
ANALYZE public.library_submissions;
ANALYZE public.smugmug_upload_queue;
