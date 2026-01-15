# Database Schema Documentation

**Last Updated:** January 15, 2026

## Overview

This document provides a comprehensive overview of the database schema for Fun Frame Photo AI Booth. The database uses PostgreSQL (via Supabase) with Row Level Security (RLS) enabled on all tables.

---

## Table of Contents

1. [Active Tables](#active-tables)
2. [Legacy Tables](#legacy-tables)
3. [Credit System Architecture](#credit-system-architecture)
4. [Foreign Key Relationships](#foreign-key-relationships)
5. [Migration History](#migration-history)

---

## Active Tables

### Core Application Tables

#### `user_profiles`
User accounts and authentication data.
- **Primary Key:** `id` (uuid, references auth.users)
- **Key Columns:**
  - `email` - User email address
  - `full_name` - Display name
  - `role` - 'user' or 'admin'
  - `subscription_tier_id` - FK to subscription_tiers_new
  - `stripe_customer_id` - Stripe customer reference
- **Status:** ✅ ACTIVE
- **Created:** Migration 20251212011232

#### `events`
Event configurations and settings.
- **Primary Key:** `id` (uuid)
- **Key Columns:**
  - `name` - Event name
  - `passcode` - Unique kiosk access code
  - `user_id` - FK to auth.users (event owner)
  - `is_active` - Whether event is currently active
  - `start_datetime` / `end_datetime` - Event availability window
- **Status:** ✅ ACTIVE
- **Created:** Migration 20251210200100

#### `prompts`
AI generation prompts/styles.
- **Primary Key:** `id` (uuid)
- **Key Columns:**
  - `name` - Prompt name
  - `prompt_text` - AI generation instructions
  - `preview_image_url` - Thumbnail for kiosk
  - `user_id` - FK to auth.users (owner, null = global)
  - `is_public` - Whether available to all users
  - `tags` - Array of categorization tags
- **Status:** ✅ ACTIVE
- **Created:** Migration 20251210200100

#### `generated_images`
All AI-generated photos.
- **Primary Key:** `id` (uuid)
- **Key Columns:**
  - `event_id` - FK to events
  - `prompt_id` - FK to prompts
  - `user_id` - FK to auth.users
  - `original_image_url` - Input photo
  - `generated_image_url` - AI output
  - `status` - 'processing', 'completed', 'failed'
- **Status:** ✅ ACTIVE
- **Created:** Migration 20251210200100

### Subscription & Pricing Tables

#### `subscription_tiers_new` ⭐ CANONICAL
Subscription plan pricing tiers.
- **Primary Key:** `id` (uuid)
- **Key Columns:**
  - `name` - Plan name (e.g., "Starter")
  - `billing_period` - 'monthly' or 'annual'
  - `price_cents` - Price in cents
  - `credits_per_period` - Image generation credits
  - `sms_credits_per_period` - SMS message credits
  - `prompts_limit` - Max prompts per event
  - `stripe_product_id` - Stripe product reference
- **Current Data:** 12 tiers (Starter, Pro, Premium, Platinum, Free, Enterprise × 2 periods)
- **Status:** ✅ ACTIVE - This is the CANONICAL subscription tiers table
- **Created:** Migration 20260110205038

#### `event_passes`
One-time event pass products.
- **Primary Key:** `id` (uuid)
- **Key Columns:**
  - `name` - Product name (unique)
  - `price_cents` - Price in cents
  - `credits` - Image generation credits
  - `sms_credits` - SMS credits
  - `duration_hours` - Pass validity period
  - `prompts_limit` - Max prompts allowed
  - `features` - JSONB array of feature descriptions
- **Current Data:** 4 event passes (150, Mid, Platinum tiers)
- **Status:** ✅ ACTIVE
- **Created:** Referenced in 20260115001815 (implicitly created)

#### `add_ons`
Optional add-on products for event passes.
- **Primary Key:** `id` (uuid)
- **Key Columns:**
  - `name` - Add-on name
  - `price_cents` - Price in cents
  - `description` - Detailed description
  - `delivery_method` - How service is delivered
- **Current Data:** 3 add-ons including "Branded Photo Gallery"
- **Status:** ✅ ACTIVE
- **Created:** Referenced in 20251230192439

#### `credit_topup_products`
One-time credit purchase products.
- **Primary Key:** `id` (uuid)
- **Key Columns:**
  - `name` - Product name (unique)
  - `credits` - Image generation credits
  - `sms_credits` - SMS credits
  - `price_cents` - Price in cents
- **Current Data:** 4 products (Small, Medium, Large, XL)
- **Status:** ✅ ACTIVE
- **Created:** Migration 20251230053523

### Credit Tracking Tables

#### `user_credits` ⚠️ COMPLEX
Per-user credit tracking (contains overlapping systems).
- **Primary Key:** `id` (uuid)
- **Unique Key:** `user_id` (references user_profiles.id)
- **Legacy Columns (System 1 - Tenant Era):**
  - `images_limit` - Monthly image limit
  - `images_used` - Current month usage
  - `sms_limit` - Monthly SMS limit
  - `sms_used` - Current month usage
  - `events_limit` - Active events limit
  - `reset_date` - Next monthly reset
- **Subscription Columns (System 2):**
  - `subscription_tier_id` - FK to subscription_tiers
  - `plan_type` - 'free', 'monthly', 'annual', 'event', 'topup'
  - `annual_credits_total` - Total credits for annual plan
  - `annual_credits_used` - Used annual credits
  - `billing_period_start` / `billing_period_end` - Billing cycle
- **New Credit System (System 3 - Ledger Based):**
  - `subscription_credits` - Credits from active subscription
  - `purchased_credits` - Credits from credit packs (never expire)
  - `event_credits` - Credits from event passes (time-limited)
  - `subscription_sms_credits` - SMS credits from subscription
  - `purchased_sms_credits` - SMS credits from purchases
  - `event_sms_credits` - SMS credits from event passes
- **Status:** ✅ ACTIVE but ⚠️ NEEDS CONSOLIDATION
- **Created:** Migration 20251229002737
- **Note:** This table has THREE overlapping credit systems. See Credit System Architecture below.

#### `credit_ledger`
Audit trail of all credit transactions.
- **Primary Key:** `id` (uuid)
- **Key Columns:**
  - `user_id` - FK to user_profiles
  - `source` - 'subscription', 'credit_pack', 'event', 'admin_grant', 'consumption'
  - `amount` - Credits added/removed
  - `balance_after` - Balance after transaction
  - `sms_amount` / `sms_balance_after` - SMS credit tracking
  - `stripe_session_id` - Payment reference
- **Status:** ✅ ACTIVE
- **Created:** Migration 20260110210944

### Purchase Tracking Tables

#### `user_subscriptions`
Active user subscriptions.
- **Primary Key:** `id` (uuid)
- **Key Columns:**
  - `user_id` - FK to user_profiles
  - `tier_id` - FK to subscription_tiers (old table)
  - `stripe_subscription_id` - Stripe reference
  - `status` - 'active', 'cancelled', 'expired', 'past_due'
  - `current_period_start` / `current_period_end` - Billing period
- **Status:** ✅ ACTIVE
- **Note:** ⚠️ References OLD subscription_tiers table, should reference subscription_tiers_new
- **Created:** Migration 20260110205038

#### `purchased_event_passes`
User purchases of event passes.
- **Primary Key:** `id` (uuid)
- **Key Columns:**
  - `user_id` - FK to user_profiles
  - `event_id` - FK to events (can be null)
  - `event_pass_tier_id` - FK to event_passes
  - `credits_allocated` / `credits_used` - Credit tracking
  - `sms_credits_allocated` / `sms_credits_used` - SMS tracking
  - `expires_at` - Pass expiration
- **Status:** ✅ ACTIVE
- **Created:** Migration 20260110205038

### Supporting Tables

#### `event_prompts`
Junction table linking events to available prompts.

#### `sms_logs`
SMS delivery tracking and audit trail.

#### `usage_logs`
General usage analytics and audit trail.

#### `global_settings`
System-wide settings (API keys, service configurations).

#### `stripe_customers`, `stripe_subscriptions`, `stripe_orders`
Stripe integration tracking tables.

#### `smugmug_upload_queue`
Queue for SmugMug photo gallery uploads.

---

## Legacy Tables

### ⚠️ Tables Pending Deprecation

#### `subscription_tiers` (OLD VERSION)
**Status:** ⚠️ LEGACY - Superseded by `subscription_tiers_new`
- **Current Data:** 8 rows
- **Problem:** user_subscriptions and user_credits still reference this table
- **Action Required:** Update foreign keys to point to subscription_tiers_new, then archive
- **Created:** Migration 20260110205038

---

## Tables That No Longer Exist (Removed)

The following tables were part of the original tenant-based architecture and have been removed:

#### `tenants` ❌ REMOVED
- Original multi-tenant organization table
- Superseded by: Individual `user_profiles` system
- Removed in: Migration 20251230214432

#### `users` ❌ REMOVED
- Original tenant-based user table
- Superseded by: `user_profiles` (direct auth.users reference)
- Removed: Early migration cleanup

#### `subscription_limits` ❌ REMOVED
- Original tenant-based subscription tracking
- Superseded by: `user_credits` + `subscription_tiers_new`
- Removed: Migration cleanup process

---

## Credit System Architecture

### Overview

The credit system has evolved through three generations, resulting in overlapping columns in the `user_credits` table.

### System 1: Legacy Tenant-Based (Deprecated)

**Columns:** `images_limit`, `images_used`, `sms_limit`, `sms_used`, `reset_date`

**Behavior:**
- Monthly hard caps
- Resets on `reset_date`
- Used in the original tenant-based architecture

**Status:** ⚠️ Deprecated but columns still exist

### System 2: Subscription-Based (Transitional)

**Columns:** `subscription_tier_id`, `annual_credits_total`, `annual_credits_used`, `billing_period_start/end`

**Behavior:**
- Links to subscription_tiers
- Tracks annual credit allocation
- Supports monthly and annual billing periods

**Status:** ⚠️ Partially active, overlaps with System 3

### System 3: Ledger-Based (Current) ⭐

**Columns:** `subscription_credits`, `purchased_credits`, `event_credits`, `subscription_sms_credits`, `purchased_sms_credits`, `event_sms_credits`

**Behavior:**
- Three separate credit pools with different expiration rules
- Backed by `credit_ledger` for full audit trail
- Supports complex purchase combinations

**Consumption Order:**
1. **Subscription credits** (first) - Reset monthly/annually
2. **Purchased credits** (second) - Never expire
3. **Event credits** (last) - Expire with event pass

**Functions:**
- `get_total_credits(user_id)` - Returns sum of all credit types
- `consume_credit(user_id, amount)` - Consumes credits in priority order
- `add_purchased_credits(user_id, credits, stripe_session_id)` - Adds credits from purchases

**Status:** ✅ ACTIVE and CANONICAL

### Credit Types

#### Image Generation Credits
- 1 credit = 1 AI image generation
- Tracked in: `subscription_credits`, `purchased_credits`, `event_credits`

#### SMS Credits
- 1 credit = 1 outbound text message
- Tracked in: `subscription_sms_credits`, `purchased_sms_credits`, `event_sms_credits`

---

## Foreign Key Relationships

### Critical Relationships

```
user_profiles (id)
├── user_credits (user_id) ✅
├── user_subscriptions (user_id) ✅
├── purchased_event_passes (user_id) ✅
├── credit_ledger (user_id) ✅
├── events (user_id) ✅
├── prompts (user_id) ✅
└── generated_images (user_id) ✅

subscription_tiers_new (id) ✅ CANONICAL
└── user_profiles (subscription_tier_id) ✅

subscription_tiers (id) ⚠️ OLD
├── user_subscriptions (tier_id) ⚠️ Should point to subscription_tiers_new
└── user_credits (subscription_tier_id) ⚠️ Should point to subscription_tiers_new

event_passes (id) ✅
├── purchased_event_passes (event_pass_tier_id) ✅
└── user_event_passes (event_pass_id) ✅

add_ons (id) ✅
├── event_pass_addons (addon_id) ✅
└── user_add_on_purchases (add_on_id) ✅

events (id) ✅
├── event_prompts (event_id) ✅
├── generated_images (event_id) ✅
├── purchased_event_passes (event_id) ✅
└── usage_logs (event_id) ✅

prompts (id) ✅
├── event_prompts (prompt_id) ✅
└── generated_images (prompt_id) ✅

generated_images (id) ✅
├── sms_logs (image_id) ✅
└── smugmug_upload_queue (generated_image_id) ✅
```

### ⚠️ Foreign Key Issues

1. **user_subscriptions.tier_id** points to OLD `subscription_tiers` instead of `subscription_tiers_new`
2. **user_credits.subscription_tier_id** points to OLD `subscription_tiers` instead of `subscription_tiers_new`

**Action Required:** These need to be updated before archiving `subscription_tiers`.

---

## Migration History

### Phase 1: Initial Schema (Dec 10, 2025)
- 20251210200100 - Created initial schema with tenants, users, subscription_limits, prompts, events, generated_images
- Multi-tenant SaaS architecture

### Phase 2: Move to User-Based (Dec 12, 2025)
- 20251212011232 - Added user_profiles table
- 20251212192253 - Optimized RLS and began moving away from tenants

### Phase 3: Credit System v2 (Dec 29, 2025)
- 20251229002737 - Created user_credits table (System 2)
- Moved from tenant-based to user-based credits

### Phase 4: Subscription Management (Jan 10, 2026)
- 20260110205038 - Created subscription_tiers, user_subscriptions, purchased_event_passes
- Added event pass support

### Phase 5: Credit Ledger System (Jan 10, 2026)
- 20260110210944 - Created credit_ledger and System 3 columns
- Added subscription_credits, purchased_credits, event_credits
- Implemented credit consumption functions

### Phase 6: SMS Credits (Jan 14, 2026)
- 20260114075612 - Added SMS credit tracking across all systems
- Added sms_credits columns to event_passes, credit_topup_products, user_credits

### Phase 7: Pricing Consolidation (Jan 15, 2026)
- 20260115001815 - Fixed pricing tables with correct data
- Created subscription_tiers_new as canonical pricing table

---

## Known Issues & Technical Debt

### 🔴 Critical

1. **Orphaned Foreign Keys**
   - `user_subscriptions.tier_id` → OLD subscription_tiers
   - `user_credits.subscription_tier_id` → OLD subscription_tiers
   - **Impact:** Cannot safely archive old subscription_tiers table
   - **Fix:** Update FKs to point to subscription_tiers_new

### 🟡 High Priority

2. **Triple Credit System in user_credits**
   - Table contains columns from 3 different credit systems
   - **Impact:** Confusion about which columns are active, duplicate data
   - **Fix:** Deprecate System 1 columns, consolidate to System 3

3. **Duplicate Subscription Tier Tables**
   - Both subscription_tiers and subscription_tiers_new exist
   - **Impact:** Confusion about canonical source
   - **Fix:** Archive subscription_tiers, rename subscription_tiers_new → subscription_tiers

### 🟢 Medium Priority

4. **Missing Documentation in Code**
   - Credit consumption logic not well documented
   - **Fix:** Add comprehensive code comments

---

## Recommended Actions

### Immediate (Next 7 Days)

1. ✅ Create this documentation (DONE)
2. ⬜ Update foreign keys from subscription_tiers → subscription_tiers_new
3. ⬜ Test all subscription flows with updated FKs
4. ⬜ Archive subscription_tiers table (rename to subscription_tiers_archive_20260115)

### Short Term (Next 30 Days)

5. ⬜ Create database views that expose only active credit columns
6. ⬜ Update application code to use views instead of direct table access
7. ⬜ Implement dual-write strategy to ensure data consistency
8. ⬜ Add database triggers to keep legacy columns in sync during transition

### Long Term (60+ Days)

9. ⬜ Deprecate System 1 columns in user_credits after verification period
10. ⬜ Rename subscription_tiers_new → subscription_tiers
11. ⬜ Create schema governance documentation
12. ⬜ Set up automated database branching tests in CI/CD

---

## Rollback Procedures

### If Foreign Key Migration Fails

```sql
-- Restore original foreign keys
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_tier_id_fkey;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_tier_id_fkey
  FOREIGN KEY (tier_id) REFERENCES subscription_tiers(id);

ALTER TABLE user_credits DROP CONSTRAINT IF EXISTS user_credits_subscription_tier_id_fkey;
ALTER TABLE user_credits ADD CONSTRAINT user_credits_subscription_tier_id_fkey
  FOREIGN KEY (subscription_tier_id) REFERENCES subscription_tiers(id);
```

### If Archive/Rename Fails

```sql
-- Restore from archive
ALTER TABLE subscription_tiers_archive_YYYYMMDD RENAME TO subscription_tiers;
```

---

## Schema Diagram

```
┌─────────────────┐
│  auth.users     │
│  (Supabase)     │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────┐
│    user_profiles            │
│  ┌──────────────────────┐   │
│  │ subscription_tier_id │───┼───→ subscription_tiers_new (CANONICAL)
│  └──────────────────────┘   │
└────────┬─────────────────┬──┘
         │                 │
         ↓                 ↓
┌─────────────────┐  ┌──────────────────┐
│  user_credits   │  │ user_subscriptions│
│  ⚠️ COMPLEX      │  │                  │
└─────────────────┘  └──────────────────┘
         │                 │
         ↓                 ↓
┌─────────────────────────────┐
│     credit_ledger           │
│  (Audit Trail for System 3) │
└─────────────────────────────┘

┌─────────────────────────────────────┐
│  Pricing Tables                     │
│  ┌────────────────────────────────┐ │
│  │ subscription_tiers_new  (NEW)  │ │
│  ├────────────────────────────────┤ │
│  │ subscription_tiers (OLD) ⚠️     │ │
│  ├────────────────────────────────┤ │
│  │ event_passes               ✅  │ │
│  ├────────────────────────────────┤ │
│  │ add_ons                    ✅  │ │
│  ├────────────────────────────────┤ │
│  │ credit_topup_products      ✅  │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘

┌────────────────────────────────────────┐
│  Core Application Tables               │
│  ┌───────────┐  ┌────────────────────┐ │
│  │  events   │  │  prompts           │ │
│  └─────┬─────┘  └───────┬────────────┘ │
│        │                │               │
│        └────────┬───────┘               │
│                 ↓                       │
│        ┌──────────────────┐             │
│        │ generated_images │             │
│        └────────┬─────────┘             │
│                 ↓                       │
│           ┌──────────┐                  │
│           │ sms_logs │                  │
│           └──────────┘                  │
└────────────────────────────────────────┘
```

---

## Support & Questions

For questions about this schema:
- Review this documentation first
- Check the inline migration comments
- Review the specific migration files in `supabase/migrations/`
- Consult the technical reference documents: `SMS_CREDITS_TECHNICAL_REFERENCE.md`, `STRIPE_SETUP_GUIDE.md`

**Document Version:** 1.0
**Last Reviewed:** January 15, 2026
