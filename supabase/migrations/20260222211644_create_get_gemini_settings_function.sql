/*
  # Create Helper Function to Get Gemini Settings
  
  Creates a SECURITY DEFINER function that edge functions can call to safely retrieve
  Gemini API configuration without exposing sensitive data through RLS policies.
  
  The function returns:
  - gemini_api_key (sensitive, only for server-side use)
  - gemini_enabled (boolean flag)
  - gemini_model (optional model override)
  - gemini_resolution (optional resolution setting)
*/

CREATE OR REPLACE FUNCTION public.get_gemini_settings()
RETURNS TABLE(
  gemini_api_key text,
  gemini_enabled boolean,
  gemini_model text,
  gemini_resolution text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    gs.gemini_api_key,
    gs.gemini_enabled,
    gs.gemini_model,
    gs.gemini_resolution
  FROM global_settings gs
  LIMIT 1;
END;
$function$;

-- Grant execute permission to service role (edge functions use this)
GRANT EXECUTE ON FUNCTION public.get_gemini_settings() TO service_role;

COMMENT ON FUNCTION public.get_gemini_settings() IS 'Securely retrieves Gemini API configuration for edge functions. SECURITY DEFINER bypasses RLS.';
