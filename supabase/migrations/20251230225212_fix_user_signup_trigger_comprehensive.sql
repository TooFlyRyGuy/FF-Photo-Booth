/*
  # Comprehensive Fix for User Signup Trigger
  
  ## Problem
  User signup is failing with "Database error saving new user" error.
  The trigger function may be failing due to:
  1. Multiple Free tier records causing confusion
  2. Exception handling preventing proper error visibility
  3. Potential race conditions or transaction issues
  
  ## Solution
  1. Ensure only ONE active Free tier exists
  2. Rewrite trigger function with better error handling and NULL checks
  3. Make the function more robust against edge cases
  
  ## Changes
  - Deactivate duplicate Free tiers (keep only the oldest one)
  - Recreate trigger function with improved error handling
  - Add explicit NULL checks and better logging
*/

-- Step 1: Ensure we have only ONE active Free tier
-- Deactivate all but the oldest Free tier
UPDATE subscription_tiers_new
SET is_active = false,
    updated_at = now()
WHERE name = 'Free' 
  AND is_active = true
  AND id != (
    SELECT id 
    FROM subscription_tiers_new 
    WHERE name = 'Free' AND is_active = true 
    ORDER BY created_at ASC 
    LIMIT 1
  );

-- Step 2: Drop and recreate the trigger function with better error handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Step 3: Create improved trigger function
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
  
  -- Insert into user_credits
  BEGIN
    RAISE LOG 'handle_new_user: Inserting into user_credits for user_id=%', NEW.id;
    
    INSERT INTO public.user_credits (
      user_id,
      images_limit,
      sms_limit,
      events_limit,
      images_used,
      sms_used,
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

-- Step 4: Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, authenticated, anon;

-- Log that migration completed
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully. Trigger function recreated with improved error handling.';
END $$;
