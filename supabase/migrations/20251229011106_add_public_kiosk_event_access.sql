/*
  # Add Public Access for Kiosk Mode Events

  1. Purpose
    - Allow anonymous (public) users to access active events via passcode
    - Enable kiosk mode to work without authentication

  2. Changes
    - Add SELECT policy for anon role on events table
    - Policy allows reading active events only (is_active = true)
    - No user_id or authentication required

  3. Security
    - Only active events are accessible
    - Read-only access (SELECT only)
    - No modification capabilities for anonymous users
*/

-- Drop existing duplicate policies if any
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can read own events" ON events;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policy for public/anonymous access to active events
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view active events" ON events;
  
  CREATE POLICY "Public can view active events"
    ON events
    FOR SELECT
    TO anon
    USING (is_active = true);
END $$;

-- Create policy for authenticated users to view their own events or all if admin
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view own events or admin can view all" ON events;
  
  CREATE POLICY "Authenticated users can view own events or admin can view all"
    ON events
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR is_current_user_admin());
END $$;
