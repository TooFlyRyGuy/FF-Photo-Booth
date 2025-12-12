/*
  # Add Performance Indexes

  This migration adds critical database indexes to improve query performance for:
  - Event loading and filtering
  - Prompt fetching
  - Dashboard statistics
  - Chart data generation

  ## New Indexes

  1. Composite Indexes
     - `events (tenant_id, is_active)` - Fast filtering of active events by tenant
     - `events (tenant_id, created_at DESC)` - Fast ordering when loading events
     - `prompts (tenant_id, is_active)` - Fast filtering of active prompts by tenant
     - `prompts (is_active, created_at DESC)` - Fast ordering of active prompts
     - `generated_images (tenant_id, status)` - Fast dashboard stats queries
     - `generated_images (tenant_id, status, created_at)` - Fast chart data queries
     - `generated_images (event_id, status)` - Fast event analytics

  2. Single Column Indexes
     - `tenants.user_id` - Fast tenant lookup by user
     - `events.is_active` - Fast filtering of active events
     - `prompts.is_active` - Fast filtering of active prompts
     - `generated_images.status` - Fast filtering by status
     - `generated_images.created_at` - Fast date-based queries

  ## Performance Impact

  These indexes will significantly speed up:
  - Event list loading in admin dashboard
  - Prompt fetching in kiosk mode
  - Dashboard statistics calculation
  - Chart data generation
  - Event analytics queries
*/

-- Tenants table
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id);

-- Events table - composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_tenant_active ON events(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_events_tenant_created ON events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_is_active ON events(is_active) WHERE is_active = true;

-- Prompts table - composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_prompts_tenant_active ON prompts(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_prompts_active_created ON prompts(is_active, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_prompts_is_active ON prompts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at DESC);

-- Generated images table - composite indexes for analytics and dashboards
CREATE INDEX IF NOT EXISTS idx_generated_images_tenant_status ON generated_images(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_generated_images_tenant_status_created ON generated_images(tenant_id, status, created_at DESC) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_generated_images_event_status ON generated_images(event_id, status) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_generated_images_status ON generated_images(status);
CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images(created_at DESC);
