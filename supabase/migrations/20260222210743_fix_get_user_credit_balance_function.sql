/*
  # Fix get_user_credit_balance Function
  
  Updates the get_user_credit_balance function to return all credit fields including:
  - image_credits (calculated as total of all credit types)
  - SMS credit fields (subscription_sms_credits, purchased_sms_credits, event_sms_credits, total_sms_credits)
  
  This ensures the frontend credit display works correctly.
*/

DROP FUNCTION IF EXISTS public.get_user_credit_balance(uuid);

CREATE FUNCTION public.get_user_credit_balance(p_user_id uuid)
RETURNS TABLE(
  subscription_credits integer,
  purchased_credits integer,
  event_credits integer,
  image_credits integer,
  total_credits integer,
  subscription_sms_credits integer,
  purchased_sms_credits integer,
  event_sms_credits integer,
  total_sms_credits integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(uc.subscription_credits, 0)::integer,
    COALESCE(uc.purchased_credits, 0)::integer,
    COALESCE(uc.event_credits, 0)::integer,
    COALESCE(
      uc.subscription_credits + 
      uc.purchased_credits + 
      uc.event_credits,
      0
    )::integer as image_credits,
    COALESCE(
      uc.subscription_credits + 
      uc.purchased_credits + 
      uc.event_credits,
      0
    )::integer as total_credits,
    COALESCE(uc.subscription_sms_credits, 0)::integer,
    COALESCE(uc.purchased_sms_credits, 0)::integer,
    COALESCE(uc.event_sms_credits, 0)::integer,
    COALESCE(
      uc.subscription_sms_credits + 
      uc.purchased_sms_credits + 
      uc.event_sms_credits,
      0
    )::integer as total_sms_credits
  FROM user_credits uc
  WHERE uc.user_id = p_user_id;
END;
$function$;
