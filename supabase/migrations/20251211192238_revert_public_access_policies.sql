/*
  # Revert Public Access Policies

  This migration removes the public access policies that were added during the restore:
  1. Removes public access to events table
  2. Removes public access to tenants table based on active events
  3. Restores the previous security model where only authenticated users or specific demo tenant access is allowed
*/

-- Drop the public access policies if they exist
DROP POLICY IF EXISTS "Public users can view active events" ON events;
DROP POLICY IF EXISTS "Public users can view tenants with active events" ON tenants;
