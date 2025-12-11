/*
  # Fix Remaining Security Issues

  ## Changes

  1. **Add Missing Foreign Key Indexes**
     - Add index on `events.created_by`
     - Add index on `generated_images.prompt_id`

  2. **Fix Trigger Function Search Path**
     - Update trigger functions to have stable search_path
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_generated_images_prompt_id ON generated_images(prompt_id);

-- =====================================================
-- 2. FIX TRIGGER FUNCTION SEARCH PATH
-- =====================================================

-- Recreate increment_image_usage trigger function with stable search_path
CREATE OR REPLACE FUNCTION increment_image_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Increment tenant usage
  UPDATE subscription_limits 
  SET images_used = images_used + 1
  WHERE tenant_id = NEW.tenant_id;

  -- Increment event total
  UPDATE events 
  SET total_generations = total_generations + 1
  WHERE id = NEW.event_id;

  -- Increment prompt usage
  UPDATE prompts 
  SET usage_count = usage_count + 1
  WHERE id = NEW.prompt_id;

  RETURN NEW;
END;
$$;

-- Recreate increment_sms_usage trigger function with stable search_path
CREATE OR REPLACE FUNCTION increment_sms_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE subscription_limits 
  SET sms_used = sms_used + 1
  WHERE tenant_id = NEW.tenant_id;

  RETURN NEW;
END;
$$;
