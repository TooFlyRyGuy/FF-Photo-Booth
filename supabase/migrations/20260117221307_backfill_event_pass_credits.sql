/*
  # Backfill Event Pass Credits for Existing Purchases
  
  1. Purpose
    - Add image credits to user_credits.event_credits for users who purchased event passes
    - Only process passes that have credits_allocated > 0
    - Ensure idempotency - don't double-credit users
  
  2. Process
    - Find all user_event_passes with credits_allocated > 0
    - Group by user_id and sum total credits that should be allocated
    - Update user_credits.event_credits for each user
    - Log the operation for audit trail
  
  3. Important Notes
    - This is a one-time backfill for existing data
    - Future purchases will be handled by the updated Stripe webhook
    - Safe to run multiple times (uses addition, not replacement)
*/

-- Backfill event pass credits for existing purchases
DO $$
DECLARE
  v_user_record RECORD;
  v_total_credits_to_add integer;
  v_users_updated integer := 0;
BEGIN
  -- For each user who has event passes with credits
  FOR v_user_record IN
    SELECT 
      uep.user_id,
      SUM(uep.credits_allocated) as total_credits
    FROM user_event_passes uep
    WHERE uep.credits_allocated > 0
    GROUP BY uep.user_id
  LOOP
    -- Get current event credits for this user
    SELECT COALESCE(event_credits, 0)
    INTO v_total_credits_to_add
    FROM user_credits
    WHERE user_id = v_user_record.user_id;
    
    -- Check if user already has event credits (to avoid double-crediting)
    -- We'll only add if current event_credits is 0 or less than total from passes
    IF v_total_credits_to_add < v_user_record.total_credits THEN
      -- Calculate how many credits to add (difference between what they should have and what they have)
      v_total_credits_to_add := v_user_record.total_credits - v_total_credits_to_add;
      
      -- Update the user_credits table
      UPDATE user_credits
      SET 
        event_credits = event_credits + v_total_credits_to_add,
        updated_at = NOW()
      WHERE user_id = v_user_record.user_id;
      
      IF FOUND THEN
        v_users_updated := v_users_updated + 1;
        RAISE NOTICE 'Backfilled % event credits for user %', v_total_credits_to_add, v_user_record.user_id;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete: Updated % users with event pass credits', v_users_updated;
END $$;