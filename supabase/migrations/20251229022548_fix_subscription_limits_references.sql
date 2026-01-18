/*
  # Fix All Subscription Limits and Tenant References

  ## Problem
  The system was migrated from a tenant-based model to a user-based model, but several triggers
  and functions still reference the old `subscription_limits` table and `tenant_id` fields that
  no longer exist. This causes errors when:
  - New users sign up
  - Images are generated
  - SMS messages are sent

  ## Changes

  ### 1. Drop Problematic Triggers
  - Drop `on_auth_user_created` trigger on auth.users
  - Drop `track_image_generation` trigger on generated_images
  - Drop `track_sms_sent` trigger on sms_logs

  ### 2. Drop/Update Problematic Functions
  - Drop `handle_new_user()` - no longer needed (replaced by user_profiles trigger)
  - Replace `increment_image_usage()` - update to use user_id and user_credits
  - Replace `increment_sms_usage()` - update to use user_id and user_credits
  - Drop `add_credits()` - references non-existent available_credits field
  - Drop `deduct_credits()` - references non-existent available_credits field

  ### 3. Create New Functions
  - New `increment_image_usage()` that works with user_id and user_credits
  - New `increment_sms_usage()` that works with user_id and user_credits

  ### 4. Recreate Triggers
  - New `track_image_generation` trigger
  - New `track_sms_sent` trigger

  ## Security
  - All functions use SECURITY DEFINER to bypass RLS for system operations
  - RLS policies remain unchanged and secure

  ## Important Notes
  - This migration fixes the tenant->user transition
  - Old subscription_limits table references are completely removed
  - New system tracks usage per user via user_credits table
*/

-- ============================================================================
-- STEP 1: Drop all problematic triggers
-- ============================================================================

-- Drop auth.users trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop generated_images trigger
DROP TRIGGER IF EXISTS track_image_generation ON generated_images;

-- Drop sms_logs trigger
DROP TRIGGER IF EXISTS track_sms_sent ON sms_logs;

-- ============================================================================
-- STEP 2: Drop problematic functions
-- ============================================================================

DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS increment_image_usage() CASCADE;
DROP FUNCTION IF EXISTS increment_sms_usage() CASCADE;
DROP FUNCTION IF EXISTS add_credits(uuid, integer, text, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS deduct_credits(uuid, integer, text, uuid) CASCADE;

-- ============================================================================
-- STEP 3: Create new increment_image_usage function
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_image_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only increment if user_id is set
  IF NEW.user_id IS NOT NULL THEN
    -- Increment user image usage (ignore if user_credits doesn't exist yet)
    UPDATE user_credits 
    SET images_used = images_used + 1,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  -- Increment event total
  UPDATE events 
  SET total_generations = total_generations + 1,
      updated_at = now()
  WHERE id = NEW.event_id;

  -- Increment prompt usage
  UPDATE prompts 
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE id = NEW.prompt_id;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 4: Create new increment_sms_usage function
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_sms_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only increment if user_id is set
  IF NEW.user_id IS NOT NULL THEN
    -- Increment user SMS usage (ignore if user_credits doesn't exist yet)
    UPDATE user_credits 
    SET sms_used = sms_used + 1,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 5: Recreate triggers
-- ============================================================================

-- Trigger for image generation tracking
CREATE TRIGGER track_image_generation
  AFTER INSERT ON generated_images
  FOR EACH ROW
  EXECUTE FUNCTION increment_image_usage();

-- Trigger for SMS tracking
CREATE TRIGGER track_sms_sent
  AFTER INSERT ON sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION increment_sms_usage();

-- ============================================================================
-- STEP 6: Create new handle_new_user function for user profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_free_tier_id uuid;
BEGIN
  -- Get the free tier ID
  SELECT id INTO v_free_tier_id
  FROM subscription_tiers_new
  WHERE name = 'Free'
  LIMIT 1;

  -- Insert user profile
  INSERT INTO public.user_profiles (
    id, 
    email, 
    subscription_tier_id,
    subscription_status,
    role,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    v_free_tier_id,
    'inactive',
    'user',
    now(), 
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert user credits with free tier limits
  INSERT INTO public.user_credits (
    user_id,
    images_limit,
    images_used,
    sms_limit,
    sms_used,
    events_limit,
    reset_date,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    10,  -- Free tier: 10 images
    0,
    5,   -- Free tier: 5 SMS
    0,
    1,   -- Free tier: 1 event
    date_trunc('month', now()) + interval '1 month',
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user for user %: % %', NEW.id, SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

-- ============================================================================
-- STEP 7: Create trigger on auth.users
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();