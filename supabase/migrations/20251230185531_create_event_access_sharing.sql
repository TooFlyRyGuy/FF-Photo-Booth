/*
  # Create Event Access Sharing System

  1. New Tables
    - `event_access`
      - `id` (uuid, primary key)
      - `event_id` (uuid, references events)
      - `user_id` (uuid, references user_profiles)
      - `granted_by` (uuid, references user_profiles - the admin who granted access)
      - `granted_at` (timestamp)
      - Unique constraint on (event_id, user_id)

  2. Changes
    - Allows admins to grant access to their events to other users
    - Users can see events they own OR events shared with them
    - Only admins can grant/revoke access

  3. Security
    - RLS enabled on event_access table
    - Only admins can grant/revoke access
    - Users can view their own access grants
*/

-- Create event_access table
CREATE TABLE IF NOT EXISTS event_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_access_user_id ON event_access(user_id);
CREATE INDEX IF NOT EXISTS idx_event_access_event_id ON event_access(event_id);

-- Enable RLS
ALTER TABLE event_access ENABLE ROW LEVEL SECURITY;

-- Admins can view all access grants
CREATE POLICY "Admins can view all event access"
  ON event_access
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Users can view their own access grants
CREATE POLICY "Users can view their own access grants"
  ON event_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only admins can grant access
CREATE POLICY "Admins can grant event access"
  ON event_access
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Only admins can revoke access
CREATE POLICY "Admins can revoke event access"
  ON event_access
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Update existing events RLS to include shared events
DROP POLICY IF EXISTS "Users can view their own events" ON events;
CREATE POLICY "Users can view their own or shared events"
  ON events
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR 
    EXISTS (
      SELECT 1 FROM event_access 
      WHERE event_access.event_id = events.id 
      AND event_access.user_id = auth.uid()
    )
  );
