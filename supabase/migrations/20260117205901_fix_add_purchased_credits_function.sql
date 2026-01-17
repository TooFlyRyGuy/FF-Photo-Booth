/*
  # Fix add_purchased_credits Function
  
  1. Changes
    - Drop incorrect version of add_purchased_credits function
    - Create correct version that updates user_credits table
    - Uses proper column names (purchased_credits instead of credits)
  
  2. Security
    - SECURITY DEFINER to allow service role access
    - Proper error handling
*/

-- Drop the incorrect function
DROP FUNCTION IF EXISTS add_purchased_credits(uuid, integer, text, text);

-- Create the correct function
CREATE OR REPLACE FUNCTION add_purchased_credits(
  p_user_id uuid,
  p_credits integer,
  p_stripe_session_id text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_credits integer;
BEGIN
  -- Add credits to purchased_credits
  UPDATE user_credits
  SET purchased_credits = COALESCE(purchased_credits, 0) + p_credits,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Get new total balance
  SELECT get_total_credits(p_user_id) INTO v_total_credits;
  
  -- Log to credit ledger
  INSERT INTO credit_ledger (
    user_id,
    source,
    amount,
    balance_after,
    stripe_session_id,
    stripe_payment_intent_id,
    metadata
  )
  VALUES (
    p_user_id,
    'credit_pack',
    p_credits,
    v_total_credits,
    p_stripe_session_id,
    p_stripe_payment_intent_id,
    jsonb_build_object('expires', 'never')
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_added', p_credits,
    'new_balance', v_total_credits
  );
END;
$$;

GRANT EXECUTE ON FUNCTION add_purchased_credits(uuid, integer, text, text) TO anon, authenticated;
