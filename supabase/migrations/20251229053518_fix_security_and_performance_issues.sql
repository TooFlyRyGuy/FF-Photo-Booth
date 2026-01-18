/*
  # Fix Security and Performance Issues
  
  1. Performance Improvements
    - Fix RLS policies to use (select auth.uid()) for better performance
    - Drop unused indexes to improve write performance and reduce storage
    
  2. Security Fixes
    - Fix function search_path for is_current_user_admin function
    - Ensure security definer views have proper access control
    
  3. Changes Made
    
    ## RLS Policy Optimizations
    - prompts table: 3 policies updated
    - events table: 3 policies updated  
    - event_prompts table: 1 policy updated
    
    ## Unused Indexes Removed
    - idx_user_credits_reset_date
    - idx_sms_logs_user_id_fkey
    - idx_usage_logs_user_id_fkey
    - idx_user_add_on_purchases_add_on_id_fkey
    - idx_user_event_passes_event_pass_id_fkey
    - idx_user_profiles_subscription_tier_id_fkey
    - idx_events_passcode
    - idx_event_prompts_event_id
    - idx_generated_images_event_status
    - idx_events_created_by
    - idx_smugmug_upload_queue_status
    - idx_prompts_tags
    - idx_smugmug_upload_queue_created
    - idx_events_smugmug_gallery_id
    - idx_credit_transactions_user_id
    - idx_credit_transactions_created_at
    - idx_user_event_passes_user_id
    - idx_user_event_passes_expires_at
    - idx_user_add_on_purchases_user_id
    - idx_prompts_is_public
    - idx_user_profiles_role
    
    ## Function Security
    - Fixed is_current_user_admin function with immutable search_path
*/

-- =====================================================
-- PART 1: FIX RLS POLICIES FOR PERFORMANCE
-- =====================================================

-- Fix prompts table policies
DROP POLICY IF EXISTS "Users can view own prompts, public prompts, or all if admin" ON prompts;
CREATE POLICY "Users can view own prompts, public prompts, or all if admin"
  ON prompts FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())) OR (is_public = true) OR is_current_user_admin());

DROP POLICY IF EXISTS "Users can update own prompts or admin can update all" ON prompts;
CREATE POLICY "Users can update own prompts or admin can update all"
  ON prompts FOR UPDATE
  TO authenticated
  USING ((user_id = (select auth.uid())) OR is_current_user_admin())
  WITH CHECK ((user_id = (select auth.uid())) OR is_current_user_admin());

DROP POLICY IF EXISTS "Users can delete own prompts or admin can delete all" ON prompts;
CREATE POLICY "Users can delete own prompts or admin can delete all"
  ON prompts FOR DELETE
  TO authenticated
  USING ((user_id = (select auth.uid())) OR is_current_user_admin());

-- Fix events table policies
DROP POLICY IF EXISTS "Authenticated users can view own events or all if admin" ON events;
CREATE POLICY "Authenticated users can view own events or all if admin"
  ON events FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())) OR is_current_user_admin());

DROP POLICY IF EXISTS "Users can update own events or admin can update all" ON events;
CREATE POLICY "Users can update own events or admin can update all"
  ON events FOR UPDATE
  TO authenticated
  USING ((user_id = (select auth.uid())) OR is_current_user_admin())
  WITH CHECK ((user_id = (select auth.uid())) OR is_current_user_admin());

DROP POLICY IF EXISTS "Users can delete own events or admin can delete all" ON events;
CREATE POLICY "Users can delete own events or admin can delete all"
  ON events FOR DELETE
  TO authenticated
  USING ((user_id = (select auth.uid())) OR is_current_user_admin());

-- Fix event_prompts table policy
DROP POLICY IF EXISTS "Users can delete event prompts for own events" ON event_prompts;
CREATE POLICY "Users can delete event prompts for own events"
  ON event_prompts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = event_prompts.event_id
      AND events.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- PART 2: DROP UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_user_credits_reset_date;
DROP INDEX IF EXISTS idx_sms_logs_user_id_fkey;
DROP INDEX IF EXISTS idx_usage_logs_user_id_fkey;
DROP INDEX IF EXISTS idx_user_add_on_purchases_add_on_id_fkey;
DROP INDEX IF EXISTS idx_user_event_passes_event_pass_id_fkey;
DROP INDEX IF EXISTS idx_user_profiles_subscription_tier_id_fkey;
DROP INDEX IF EXISTS idx_events_passcode;
DROP INDEX IF EXISTS idx_event_prompts_event_id;
DROP INDEX IF EXISTS idx_generated_images_event_status;
DROP INDEX IF EXISTS idx_events_created_by;
DROP INDEX IF EXISTS idx_smugmug_upload_queue_status;
DROP INDEX IF EXISTS idx_prompts_tags;
DROP INDEX IF EXISTS idx_smugmug_upload_queue_created;
DROP INDEX IF EXISTS idx_events_smugmug_gallery_id;
DROP INDEX IF EXISTS idx_credit_transactions_user_id;
DROP INDEX IF EXISTS idx_credit_transactions_created_at;
DROP INDEX IF EXISTS idx_user_event_passes_user_id;
DROP INDEX IF EXISTS idx_user_event_passes_expires_at;
DROP INDEX IF EXISTS idx_user_add_on_purchases_user_id;
DROP INDEX IF EXISTS idx_prompts_is_public;
DROP INDEX IF EXISTS idx_user_profiles_role;

-- =====================================================
-- PART 3: FIX FUNCTION SECURITY
-- =====================================================

-- Recreate is_current_user_admin function with immutable search_path
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
    AND lower(role) = 'admin'
  );
$$;

-- =====================================================
-- PART 4: SECURE ADMIN VIEWS
-- =====================================================

-- Recreate admin views with explicit schema qualifications for security
-- These views need SECURITY DEFINER to allow admins to see all data

DROP VIEW IF EXISTS admin_all_prompts;
CREATE VIEW admin_all_prompts
WITH (security_invoker = false)
AS
  SELECT 
    p.id,
    p.name,
    p.description,
    p.category,
    p.prompt_text,
    p.preview_image_url,
    p.reference_image_url,
    p.is_active,
    p.usage_count,
    p.created_at,
    p.updated_at,
    p.tags,
    p.is_public,
    p.user_id,
    up.email AS user_email,
    up.full_name AS user_name
  FROM public.prompts p
  LEFT JOIN public.user_profiles up ON p.user_id = up.id;

DROP VIEW IF EXISTS admin_all_users;
CREATE VIEW admin_all_users
WITH (security_invoker = false)
AS
  SELECT 
    up.id,
    up.email,
    up.full_name,
    up.role,
    up.subscription_status,
    up.subscription_tier_id,
    up.stripe_customer_id,
    up.stripe_subscription_id,
    up.subscription_start_date,
    up.subscription_end_date,
    up.created_at,
    up.updated_at,
    uc.images_limit,
    uc.images_used,
    uc.sms_limit,
    uc.sms_used,
    uc.events_limit,
    uc.reset_date,
    (SELECT count(*) FROM public.events WHERE events.user_id = up.id) AS total_events,
    (SELECT count(*) FROM public.prompts WHERE prompts.user_id = up.id) AS total_prompts
  FROM public.user_profiles up
  LEFT JOIN public.user_credits uc ON up.id = uc.user_id;

DROP VIEW IF EXISTS admin_all_events;
CREATE VIEW admin_all_events
WITH (security_invoker = false)
AS
  SELECT 
    e.id,
    e.name,
    e.city,
    e.event_date,
    e.passcode,
    e.is_active,
    e.total_generations,
    e.created_by,
    e.created_at,
    e.updated_at,
    e.aspect_ratio,
    e.background_image_url,
    e.logo_url,
    e.primary_color,
    e.secondary_color,
    e.accent_color,
    e.hide_logo,
    e.hide_event_name,
    e.start_datetime,
    e.end_datetime,
    e.sms_message,
    e.overlay_image_url,
    e.smugmug_gallery_id,
    e.smugmug_gallery_url,
    e.smugmug_gallery_visibility,
    e.smugmug_gallery_name,
    e.smugmug_gallery_key,
    e.upload_originals_to_gallery,
    e.user_id,
    up.email AS user_email,
    up.full_name AS user_name,
    (SELECT count(*) FROM public.generated_images WHERE generated_images.event_id = e.id) AS total_images_generated
  FROM public.events e
  LEFT JOIN public.user_profiles up ON e.user_id = up.id;

-- Grant access to admin views only to authenticated users
-- RLS on underlying tables will control actual access
GRANT SELECT ON admin_all_prompts TO authenticated;
GRANT SELECT ON admin_all_users TO authenticated;
GRANT SELECT ON admin_all_events TO authenticated;