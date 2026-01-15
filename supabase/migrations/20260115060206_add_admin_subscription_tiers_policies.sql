/*
  # Add Admin Policies for Subscription Tiers Management

  1. Changes
    - Add INSERT policy for admins to create new subscription tiers
    - Add UPDATE policy for admins to modify subscription tiers
    - Add DELETE policy for admins to remove subscription tiers
    - Add SELECT policy for admins to view all tiers (including inactive)

  2. Security
    - All policies check for admin role using is_current_user_admin() function
    - Only authenticated users with admin role can modify subscription tiers
*/

-- Allow admins to view all subscription tiers (including inactive ones)
CREATE POLICY "Admins can view all subscription tiers"
  ON subscription_tiers_new
  FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

-- Allow admins to insert new subscription tiers
CREATE POLICY "Admins can insert subscription tiers"
  ON subscription_tiers_new
  FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin());

-- Allow admins to update subscription tiers
CREATE POLICY "Admins can update subscription tiers"
  ON subscription_tiers_new
  FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Allow admins to delete subscription tiers
CREATE POLICY "Admins can delete subscription tiers"
  ON subscription_tiers_new
  FOR DELETE
  TO authenticated
  USING (is_current_user_admin());