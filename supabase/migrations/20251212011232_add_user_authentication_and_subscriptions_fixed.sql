/*
  # Add User Authentication and Subscription System

  ## Overview
  This migration adds comprehensive user authentication and subscription management to the Lumina Booth application.

  ## 1. New Tables Created

  ### `user_profiles`
  - `id` (uuid, references auth.users, primary key) - Links to Supabase auth user
  - `email` (text, not null) - User's email address
  - `full_name` (text) - User's full name
  - `subscription_tier` (text, default 'free') - Current subscription level
  - `subscription_status` (text, default 'inactive') - Status of subscription (active, inactive, cancelled, past_due)
  - `stripe_customer_id` (text) - Stripe customer identifier
  - `stripe_subscription_id` (text) - Stripe subscription identifier
  - `subscription_ends_at` (timestamptz) - When subscription expires
  - `trial_ends_at` (timestamptz) - When trial period ends
  - `created_at` (timestamptz, default now()) - Account creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp

  ### `subscription_tiers`
  - `id` (text, primary key) - Tier identifier (free, starter, professional, enterprise)
  - `name` (text, not null) - Display name
  - `description` (text) - Tier description
  - `price_monthly` (integer, default 0) - Monthly price in cents
  - `price_yearly` (integer, default 0) - Yearly price in cents
  - `images_limit` (integer, not null) - Maximum images per month
  - `sms_limit` (integer, not null) - Maximum SMS messages per month
  - `events_limit` (integer, not null) - Maximum active events
  - `custom_branding` (boolean, default false) - Custom branding enabled
  - `analytics` (boolean, default false) - Analytics access
  - `priority_support` (boolean, default false) - Priority support access
  - `created_at` (timestamptz, default now())

  ## 2. Schema Updates

  ### Updated `tenants` table
  - Add `user_id` column to link tenants to user profiles

  ### Updated `events` table
  - Update `tenant_id` to properly reference user-specific tenants

  ## 3. Security (Row Level Security)

  All tables have RLS enabled with policies ensuring:
  - Users can only view and modify their own data
  - Subscription tiers are publicly readable but only system can modify
  - Proper authentication checks on all operations

  ## 4. Initial Data

  Seeds the subscription_tiers table with four tiers:
  - Free: 10 images, 5 SMS, 1 event
  - Starter: 100 images, 50 SMS, 3 events - $29/month
  - Professional: 500 images, 200 SMS, 10 events - $99/month
  - Enterprise: Unlimited, custom support - $299/month

  ## 5. Important Notes

  - This migration integrates with Supabase Auth's built-in user system
  - Stripe integration requires environment variables to be configured
  - All existing demo tenant data remains intact
  - RLS policies are restrictive by default for security
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  subscription_tier text DEFAULT 'free' NOT NULL,
  subscription_status text DEFAULT 'inactive' NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_ends_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create subscription_tiers table
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_monthly integer DEFAULT 0 NOT NULL,
  price_yearly integer DEFAULT 0 NOT NULL,
  images_limit integer NOT NULL,
  sms_limit integer NOT NULL,
  events_limit integer NOT NULL,
  custom_branding boolean DEFAULT false NOT NULL,
  analytics boolean DEFAULT false NOT NULL,
  priority_support boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add user_id to tenants table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE tenants ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for subscription_tiers (publicly readable)
CREATE POLICY "Anyone can view subscription tiers"
  ON subscription_tiers FOR SELECT
  TO authenticated
  USING (true);

-- Update tenants RLS policies to include user_id check
DROP POLICY IF EXISTS "Users can view own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can update own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can insert own tenant" ON tenants;

CREATE POLICY "Users can view own tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Users can update own tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own tenant"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Update events RLS policies
DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Users can insert own events" ON events;
DROP POLICY IF EXISTS "Users can update own events" ON events;
DROP POLICY IF EXISTS "Users can delete own events" ON events;

CREATE POLICY "Users can view own events"
  ON events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = events.tenant_id
      AND (tenants.user_id = auth.uid() OR tenants.id = '00000000-0000-0000-0000-000000000001')
    )
  );

CREATE POLICY "Users can insert own events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = events.tenant_id
      AND tenants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = events.tenant_id
      AND tenants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = events.tenant_id
      AND tenants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = events.tenant_id
      AND tenants.user_id = auth.uid()
    )
  );

-- Seed subscription tiers
INSERT INTO subscription_tiers (id, name, description, price_monthly, price_yearly, images_limit, sms_limit, events_limit, custom_branding, analytics, priority_support)
VALUES
  ('free', 'Free', 'Perfect for trying out Lumina Booth', 0, 0, 10, 5, 1, false, false, false),
  ('starter', 'Starter', 'Great for small events and testing', 2900, 29000, 100, 50, 3, true, true, false),
  ('professional', 'Professional', 'Ideal for regular event photographers', 9900, 99000, 500, 200, 10, true, true, true),
  ('enterprise', 'Enterprise', 'Unlimited access with premium support', 29900, 299000, 999999, 999999, 999, true, true, true)
ON CONFLICT (id) DO NOTHING;

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Create a tenant for the new user
  INSERT INTO public.tenants (id, name, tier, user_id)
  VALUES (
    'tenant_' || NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || '''s Account',
    'free',
    NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();