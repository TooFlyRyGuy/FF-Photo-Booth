/*
  # Fix User Signup - Add Missing reset_date Field
  
  ## Problem
  The handle_new_user() trigger function is not including the reset_date field
  when inserting into user_credits, which could cause issues even though the
  column has a default value.
  
  ## Solution
  Update the trigger function to explicitly include reset_date in the INSERT statement.
  
  ## Changes
  - Recreate handle_new_user() function with reset_date field included
  - Keep all existing error handling and logging
*/

-- Drop and recreate the trigger function with reset_date
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  free_tier_id uuid;
  v_error_message text;
  v_error_detail text;
  v_error_hint text;
BEGIN
  -- Log the start of the trigger
  RAISE LOG 'handle_new_user: Starting for user_id=% email=%', NEW.id, NEW.email;
  
  -- Get the Free tier subscription ID
  BEGIN
    SELECT id INTO STRICT free_tier_id
    FROM subscription_tiers_new
    WHERE name = 'Free' AND is_active = true
    LIMIT 1;
    
    RAISE LOG 'handle_new_user: Found free_tier_id=%', free_tier_id;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE LOG 'handle_new_user: ERROR - No active Free tier found';
      RAISE EXCEPTION 'No active Free subscription tier found. Please contact support.';
    WHEN TOO_MANY_ROWS THEN
      -- Should not happen after our cleanup, but handle it anyway
      SELECT id INTO free_tier_id
      FROM subscription_tiers_new
      WHERE name = 'Free' AND is_active = true
      ORDER BY created_at ASC
      LIMIT 1;
      RAISE LOG 'handle_new_user: WARNING - Multiple Free tiers found, using oldest: %', free_tier_id;
  END;
  
  -- Insert into user_profiles
  BEGIN
    RAISE LOG 'handle_new_user: Inserting into user_profiles for user_id=%', NEW.id;
    
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
      free_tier_id,
      'active',
      'user',
      now(),
      now()
    );
    
    RAISE LOG 'handle_new_user: Successfully inserted user_profiles for user_id=%', NEW.id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE LOG 'handle_new_user: User profile already exists for user_id=%', NEW.id;
      -- If profile already exists, that's okay, just continue
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_error_message = MESSAGE_TEXT,
        v_error_detail = PG_EXCEPTION_DETAIL,
        v_error_hint = PG_EXCEPTION_HINT;
      RAISE LOG 'handle_new_user: ERROR in user_profiles insert - SQLSTATE=% MESSAGE=% DETAIL=% HINT=%',
        SQLSTATE, v_error_message, v_error_detail, v_error_hint;
      RAISE EXCEPTION 'Failed to create user profile: %', v_error_message;
  END;
  
  -- Insert into user_credits with reset_date
  BEGIN
    RAISE LOG 'handle_new_user: Inserting into user_credits for user_id=%', NEW.id;
    
    INSERT INTO public.user_credits (
      user_id,
      images_limit,
      sms_limit,
      events_limit,
      images_used,
      sms_used,
      reset_date,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      10,  -- Free tier: 10 images
      5,   -- Free tier: 5 SMS
      1,   -- Free tier: 1 event
      0,
      0,
      date_trunc('month', now()) + interval '1 month',
      now(),
      now()
    );
    
    RAISE LOG 'handle_new_user: Successfully inserted user_credits for user_id=%', NEW.id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE LOG 'handle_new_user: User credits already exist for user_id=%', NEW.id;
      -- If credits already exist, that's okay, just continue
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_error_message = MESSAGE_TEXT,
        v_error_detail = PG_EXCEPTION_DETAIL,
        v_error_hint = PG_EXCEPTION_HINT;
      RAISE LOG 'handle_new_user: ERROR in user_credits insert - SQLSTATE=% MESSAGE=% DETAIL=% HINT=%',
        SQLSTATE, v_error_message, v_error_detail, v_error_hint;
      RAISE EXCEPTION 'Failed to create user credits: %', v_error_message;
  END;
  
  RAISE LOG 'handle_new_user: Successfully completed for user_id=%', NEW.id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_error_message = MESSAGE_TEXT,
      v_error_detail = PG_EXCEPTION_DETAIL,
      v_error_hint = PG_EXCEPTION_HINT;
    RAISE LOG 'handle_new_user: FATAL ERROR for user_id=% - SQLSTATE=% MESSAGE=% DETAIL=% HINT=%',
      NEW.id, SQLSTATE, v_error_message, v_error_detail, v_error_hint;
    -- Re-raise to fail the auth.users insert
    RAISE;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, authenticated, anon;
