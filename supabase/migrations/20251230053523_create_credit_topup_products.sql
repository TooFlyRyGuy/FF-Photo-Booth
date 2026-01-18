/*
  # Create Credit Top-Up Products Table

  1. New Tables
    - `credit_topup_products`
      - `id` (uuid, primary key)
      - `name` (text) - Display name (e.g., "100 Credits Pack")
      - `credits` (integer) - Number of credits included
      - `price_cents` (integer) - Price in cents
      - `stripe_price_id` (text, optional) - Stripe price ID
      - `stripe_product_id` (text, optional) - Stripe product ID
      - `is_active` (boolean) - Whether product is available for purchase
      - `display_order` (integer) - Display order in UI
      - `created_at` (timestamptz)
      
  2. Security
    - Enable RLS on `credit_topup_products` table
    - Add policies for:
      - Public users can view active products
      - Admin users can create, update, delete products
*/

CREATE TABLE IF NOT EXISTS credit_topup_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL,
  price_cents integer NOT NULL,
  stripe_price_id text,
  stripe_product_id text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE credit_topup_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active credit top-up products"
  ON credit_topup_products
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin users can view all credit top-up products"
  ON credit_topup_products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can insert credit top-up products"
  ON credit_topup_products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update credit top-up products"
  ON credit_topup_products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete credit top-up products"
  ON credit_topup_products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_credit_topup_products_active_display
  ON credit_topup_products(is_active, display_order);
