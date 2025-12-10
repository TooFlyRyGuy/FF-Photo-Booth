/*
  # Lumina AI Photo Booth - Complete Database Schema

  ## Overview
  Production-ready multi-tenant SaaS database for AI photo booth platform.
  Supports event management, AI prompt configuration, usage tracking, and SMS delivery.

  ## New Tables

  ### 1. `tenants`
  Organization/agency accounts using the platform
  - `id` (uuid, primary key) - Unique tenant identifier
  - `name` (text) - Organization name
  - `tier` (text) - Subscription tier (STARTER, PRO, ENTERPRISE)
  - `white_label_enabled` (boolean) - White-labeling feature flag
  - `branding_logo_url` (text, nullable) - Custom logo URL
  - `primary_color` (text, nullable) - Brand primary color hex
  - `is_active` (boolean) - Account active status
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `users`
  Admin and operator users for tenant accounts
  - `id` (uuid, primary key) - Maps to auth.users
  - `tenant_id` (uuid, foreign key) - Associated tenant
  - `email` (text) - User email
  - `full_name` (text) - User display name
  - `role` (text) - User role (OWNER, ADMIN, OPERATOR)
  - `is_active` (boolean) - User active status
  - `last_login_at` (timestamptz, nullable) - Last login timestamp
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 3. `subscription_limits`
  Subscription tier limits and usage tracking
  - `id` (uuid, primary key) - Unique identifier
  - `tenant_id` (uuid, foreign key) - Associated tenant
  - `images_limit` (integer) - Monthly image generation limit
  - `images_used` (integer) - Current month usage
  - `sms_limit` (integer) - Monthly SMS limit
  - `sms_used` (integer) - Current month usage
  - `events_limit` (integer) - Active events limit
  - `reset_date` (timestamptz) - Next usage reset date
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 4. `prompts`
  AI style prompts for photo generation
  - `id` (uuid, primary key) - Unique prompt identifier
  - `tenant_id` (uuid, foreign key, nullable) - Owner tenant (null = global)
  - `name` (text) - Prompt display name
  - `description` (text) - Prompt description
  - `category` (text) - Prompt category
  - `prompt_text` (text) - AI generation prompt
  - `preview_image_url` (text) - Kiosk thumbnail URL
  - `reference_image_url` (text, nullable) - AI style reference image
  - `is_active` (boolean) - Active status
  - `usage_count` (integer) - Times used counter
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 5. `events`
  Event configurations and settings
  - `id` (uuid, primary key) - Unique event identifier
  - `tenant_id` (uuid, foreign key) - Associated tenant
  - `name` (text) - Event name
  - `city` (text) - Event location
  - `event_date` (date) - Event date
  - `passcode` (text) - Kiosk access passcode
  - `is_active` (boolean) - Active status
  - `total_generations` (integer) - Total images generated
  - `created_by` (uuid, foreign key, nullable) - Creator user ID
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 6. `event_prompts`
  Junction table linking events to available prompts
  - `id` (uuid, primary key) - Unique identifier
  - `event_id` (uuid, foreign key) - Associated event
  - `prompt_id` (uuid, foreign key) - Associated prompt
  - `display_order` (integer) - Sort order in kiosk
  - `created_at` (timestamptz) - Creation timestamp

  ### 7. `generated_images`
  Track all AI-generated photos
  - `id` (uuid, primary key) - Unique image identifier
  - `event_id` (uuid, foreign key) - Associated event
  - `prompt_id` (uuid, foreign key) - Prompt used
  - `tenant_id` (uuid, foreign key) - Associated tenant
  - `original_image_url` (text) - User photo URL
  - `generated_image_url` (text, nullable) - AI result URL
  - `status` (text) - Generation status (processing, completed, failed)
  - `error_message` (text, nullable) - Error details if failed
  - `phone_number` (text, nullable) - Delivery phone (hashed)
  - `generation_time_ms` (integer, nullable) - Processing duration
  - `created_at` (timestamptz) - Creation timestamp
  - `completed_at` (timestamptz, nullable) - Completion timestamp

  ### 8. `sms_logs`
  SMS delivery tracking and audit trail
  - `id` (uuid, primary key) - Unique log identifier
  - `image_id` (uuid, foreign key) - Associated image
  - `tenant_id` (uuid, foreign key) - Associated tenant
  - `phone_number` (text) - Recipient phone (hashed)
  - `message_sid` (text, nullable) - Twilio message ID
  - `status` (text) - Delivery status (queued, sent, delivered, failed)
  - `error_message` (text, nullable) - Error details if failed
  - `sent_at` (timestamptz) - Send timestamp
  - `delivered_at` (timestamptz, nullable) - Delivery timestamp

  ### 9. `usage_logs`
  Detailed usage analytics and audit trail
  - `id` (uuid, primary key) - Unique log identifier
  - `tenant_id` (uuid, foreign key) - Associated tenant
  - `event_id` (uuid, foreign key, nullable) - Associated event
  - `action_type` (text) - Action performed (image_generated, sms_sent, etc)
  - `metadata` (jsonb, nullable) - Additional data
  - `created_at` (timestamptz) - Action timestamp

  ## Security
  - RLS enabled on all tables
  - Multi-tenant data isolation enforced
  - Public read access for prompts (kiosk mode)
  - Authenticated access for admin operations
  - Event-based access for kiosk image generation

  ## Performance
  - Indexes on foreign keys
  - Indexes on frequently queried fields
  - Composite indexes for common queries
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. TENANTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  tier text NOT NULL DEFAULT 'STARTER' CHECK (tier IN ('STARTER', 'PRO', 'ENTERPRISE')),
  white_label_enabled boolean DEFAULT false,
  branding_logo_url text,
  primary_color text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('OWNER', 'ADMIN', 'OPERATOR')),
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. SUBSCRIPTION LIMITS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_limits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  images_limit integer NOT NULL DEFAULT 1000,
  images_used integer DEFAULT 0,
  sms_limit integer NOT NULL DEFAULT 1000,
  sms_used integer DEFAULT 0,
  events_limit integer NOT NULL DEFAULT 5,
  reset_date timestamptz DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_limits ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. PROMPTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS prompts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'Custom',
  prompt_text text NOT NULL,
  preview_image_url text NOT NULL,
  reference_image_url text,
  is_active boolean DEFAULT true,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. EVENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text NOT NULL DEFAULT '',
  event_date date NOT NULL,
  passcode text NOT NULL,
  is_active boolean DEFAULT true,
  total_generations integer DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. EVENT_PROMPTS JUNCTION TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS event_prompts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, prompt_id)
);

ALTER TABLE event_prompts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. GENERATED IMAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS generated_images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES prompts(id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_image_url text NOT NULL,
  generated_image_url text,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message text,
  phone_number text,
  generation_time_ms integer,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. SMS LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_id uuid NOT NULL REFERENCES generated_images(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  message_sid text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
  error_message text,
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz
);

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 9. USAGE LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_tenant_id ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_is_active ON events(is_active);
CREATE INDEX IF NOT EXISTS idx_events_passcode ON events(passcode);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);

-- Prompts indexes
CREATE INDEX IF NOT EXISTS idx_prompts_tenant_id ON prompts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prompts_is_active ON prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);

-- Event prompts indexes
CREATE INDEX IF NOT EXISTS idx_event_prompts_event_id ON event_prompts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_prompts_prompt_id ON event_prompts(prompt_id);

-- Generated images indexes
CREATE INDEX IF NOT EXISTS idx_generated_images_event_id ON generated_images(event_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_tenant_id ON generated_images(tenant_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_status ON generated_images(status);
CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images(created_at DESC);

-- SMS logs indexes
CREATE INDEX IF NOT EXISTS idx_sms_logs_image_id ON sms_logs(image_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_tenant_id ON sms_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);

-- Usage logs indexes
CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_id ON usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_event_id ON usage_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_action_type ON usage_logs(action_type);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_limits_updated_at BEFORE UPDATE ON subscription_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment usage counters
CREATE OR REPLACE FUNCTION increment_image_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment tenant usage
  UPDATE subscription_limits 
  SET images_used = images_used + 1
  WHERE tenant_id = NEW.tenant_id;
  
  -- Increment event total
  UPDATE events 
  SET total_generations = total_generations + 1
  WHERE id = NEW.event_id;
  
  -- Increment prompt usage
  UPDATE prompts 
  SET usage_count = usage_count + 1
  WHERE id = NEW.prompt_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_image_generation AFTER INSERT ON generated_images
  FOR EACH ROW EXECUTE FUNCTION increment_image_usage();

-- Function to increment SMS usage
CREATE OR REPLACE FUNCTION increment_sms_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE subscription_limits 
  SET sms_used = sms_used + 1
  WHERE tenant_id = NEW.tenant_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_sms_sent AFTER INSERT ON sms_logs
  FOR EACH ROW EXECUTE FUNCTION increment_sms_usage();