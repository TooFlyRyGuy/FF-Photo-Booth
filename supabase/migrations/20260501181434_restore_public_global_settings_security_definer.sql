/*
  # Restore public_global_settings view as SECURITY DEFINER

  ## Problem
  The view was changed to SECURITY INVOKER which broke the kiosk mode.
  Unauthenticated (anon) users running the kiosk need to read non-sensitive
  global settings (gemini_enabled, twilio_enabled, etc.) but anon has no
  SELECT policy on the underlying global_settings table.

  ## Solution
  SECURITY DEFINER is the CORRECT and SAFE pattern here because:
  - The view only exposes non-sensitive columns (no API keys, no auth tokens)
  - It allows anon/kiosk users to read operational flags (enabled/disabled)
  - Sensitive columns (gemini_api_key, twilio_auth_token, etc.) are NOT in this view

  This is the intended architecture: admin keys stay server-side only
  (fetched by edge functions via service role), while public flags are
  readable by the kiosk via this safe view.
*/

DROP VIEW IF EXISTS public.public_global_settings;

CREATE VIEW public.public_global_settings
  WITH (security_invoker = false)
AS
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
