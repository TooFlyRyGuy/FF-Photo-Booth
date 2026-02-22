/*
  # Fix Security Definer View and Function Search Paths

  ## Overview
  This migration addresses two security concerns:
  1. Removes SECURITY DEFINER from public_global_settings view (unnecessary and risky)
  2. Fixes remaining functions with mutable search paths

  ## Changes Made
  
  1. **public_global_settings View**
     - Recreate without SECURITY DEFINER property
     - Maintains same functionality but with caller's privileges
     - Exposes only non-sensitive configuration fields
  
  2. **Functions with Immutable Search Paths**
     - add_purchased_sms_credits: Set search_path to 'public, pg_temp'
     - add_purchased_credits: Set search_path to 'public, pg_temp'
  
  ## Security Impact
  - Removes unnecessary privilege escalation risk from view
  - Prevents search_path manipulation attacks on functions
*/

-- Drop and recreate public_global_settings view without SECURITY DEFINER
DROP VIEW IF EXISTS public_global_settings;

CREATE VIEW public_global_settings AS
SELECT
  id,
  singleton_id,
  gemini_enabled,
  gemini_model,
  gemini_resolution,
  twilio_enabled,
  twilio_phone_number,
  smugmug_user_nickname,
  smugmug_connection_status,
  smugmug_default_visibility,
  use_smugmug_for_sms,
  smugmug_username,
  smugmug_last_auth_date,
  created_at,
  updated_at
FROM global_settings;

-- Grant appropriate permissions
GRANT SELECT ON public_global_settings TO authenticated;
GRANT SELECT ON public_global_settings TO anon;

-- Fix add_purchased_sms_credits function
DROP FUNCTION IF EXISTS add_purchased_sms_credits(uuid, integer) CASCADE;

CREATE FUNCTION add_purchased_sms_credits(
  p_user_id uuid,
  p_amount integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO user_credits (user_id, purchased_sms_credits)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET
    purchased_sms_credits = user_credits.purchased_sms_credits + p_amount;
END;
$$;

-- Fix add_purchased_credits function
DROP FUNCTION IF EXISTS add_purchased_credits(uuid, integer) CASCADE;

CREATE FUNCTION add_purchased_credits(
  p_user_id uuid,
  p_amount integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO user_credits (user_id, purchased_credits)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET
    purchased_credits = user_credits.purchased_credits + p_amount;
END;
$$;
