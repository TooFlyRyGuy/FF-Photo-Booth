/*
  # Remove SECURITY DEFINER Admin Views

  1. Changes
    - Drop `admin_all_events` view
    - Drop `admin_all_prompts` view  
    - Drop `admin_all_users` view

  2. Rationale
    - These SECURITY DEFINER views bypass RLS and create potential security risks
    - Existing RLS policies already grant admins full access to all base tables
    - Admin functionality can be maintained by querying base tables directly
    - Enhances security by removing privilege escalation paths
    - Improves transparency as all access control is in RLS policies

  3. Impact
    - Frontend queries will need to query base tables directly instead of views
    - No loss of functionality as admins can access all data through RLS policies
    - Better security posture with no SECURITY DEFINER objects
*/

-- Drop the three SECURITY DEFINER admin views
DROP VIEW IF EXISTS admin_all_events;
DROP VIEW IF EXISTS admin_all_prompts;
DROP VIEW IF EXISTS admin_all_users;
