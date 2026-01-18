/*
  # Allow Admin to Reassign Event Ownership

  1. Changes
    - Add policy to allow admins to update user_id on events
    - This enables admins to transfer event ownership to any user

  2. Security
    - Only users with role='admin' can reassign events
    - Regular users cannot modify event ownership
*/

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Admins can update any event" ON events;

-- Create comprehensive admin update policy that includes user_id changes
CREATE POLICY "Admins can update any event"
  ON events
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Ensure users can update their own events (existing functionality)
DROP POLICY IF EXISTS "Users can update own events" ON events;
CREATE POLICY "Users can update own events"
  ON events
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());