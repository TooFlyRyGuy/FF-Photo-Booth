# Database Cleanup & Consolidation Guide

**Date:** January 15, 2026
**Status:** Ready for Implementation
**Risk Level:** MEDIUM (Requires careful testing)

---

## Executive Summary

Your database currently has **working tables** but contains legacy structures that create technical debt. The critical issue preventing database branching has been resolved (event_passes and add_ons tables exist), but several cleanup tasks remain.

**Current State:**
- ✅ All required tables exist
- ✅ Foreign key constraints are satisfied
- ⚠️ Legacy subscription_tiers table still referenced by active foreign keys
- ⚠️ user_credits table contains columns from 3 different credit systems

**Goal:**
- Clean up legacy table references
- Archive deprecated tables safely
- Consolidate credit system
- Enable safe database branching

---

## Phase 1: Update Foreign Key References (CRITICAL)

### Problem

Two foreign keys still point to the OLD `subscription_tiers` table instead of the NEW `subscription_tiers_new`:

1. `user_subscriptions.tier_id` → subscription_tiers (should → subscription_tiers_new)
2. `user_credits.subscription_tier_id` → subscription_tiers (should → subscription_tiers_new)

This prevents us from safely archiving the old table.

### Pre-Migration Checklist

- [ ] Backup database
- [ ] Verify no active subscriptions are using subscription_tiers
- [ ] Check data consistency between old and new tier tables
- [ ] Test on staging environment first

### Migration Steps

#### Step 1: Verify Current State

```sql
-- Check how many rows reference subscription_tiers
SELECT COUNT(*) FROM user_subscriptions WHERE tier_id IS NOT NULL;
SELECT COUNT(*) FROM user_credits WHERE subscription_tier_id IS NOT NULL;

-- Check if any subscription_tier_ids don't have corresponding entries in subscription_tiers_new
SELECT uc.id, uc.subscription_tier_id
FROM user_credits uc
LEFT JOIN subscription_tiers st ON uc.subscription_tier_id = st.id
LEFT JOIN subscription_tiers_new stn ON st.name = stn.name AND st.plan_type = stn.billing_period
WHERE uc.subscription_tier_id IS NOT NULL AND stn.id IS NULL;

SELECT us.id, us.tier_id
FROM user_subscriptions us
LEFT JOIN subscription_tiers st ON us.tier_id = st.id
LEFT JOIN subscription_tiers_new stn ON st.name = stn.name AND st.plan_type = stn.billing_period
WHERE us.tier_id IS NOT NULL AND stn.id IS NULL;
```

#### Step 2: Create Mapping Function

Create a function to map old tier IDs to new tier IDs:

```sql
CREATE OR REPLACE FUNCTION migrate_tier_id(old_tier_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  new_tier_id uuid;
BEGIN
  -- Map from old subscription_tiers to new subscription_tiers_new
  -- Based on matching name and billing period
  SELECT stn.id INTO new_tier_id
  FROM subscription_tiers st
  JOIN subscription_tiers_new stn ON st.name = stn.name AND st.plan_type = stn.billing_period
  WHERE st.id = old_tier_id;

  RETURN new_tier_id;
END;
$$;
```

#### Step 3: Update user_subscriptions Foreign Key

**⚠️ IMPORTANT:** Do this in a transaction so you can rollback if needed.

```sql
BEGIN;

-- Step 3a: Drop the old foreign key constraint
ALTER TABLE user_subscriptions
DROP CONSTRAINT IF EXISTS user_subscriptions_tier_id_fkey;

-- Step 3b: Update tier_id values to point to new table
-- (Only if there are rows to update)
UPDATE user_subscriptions us
SET tier_id = migrate_tier_id(tier_id)
WHERE tier_id IS NOT NULL;

-- Step 3c: Add new foreign key pointing to subscription_tiers_new
ALTER TABLE user_subscriptions
ADD CONSTRAINT user_subscriptions_tier_id_fkey
FOREIGN KEY (tier_id) REFERENCES subscription_tiers_new(id)
ON DELETE SET NULL;

-- Step 3d: Verify the changes
SELECT COUNT(*) FROM user_subscriptions WHERE tier_id IS NOT NULL;

-- If everything looks good:
COMMIT;

-- If something went wrong:
-- ROLLBACK;
```

#### Step 4: Update user_credits Foreign Key

```sql
BEGIN;

-- Step 4a: Drop the old foreign key constraint
ALTER TABLE user_credits
DROP CONSTRAINT IF EXISTS user_credits_subscription_tier_id_fkey;

-- Step 4b: Update subscription_tier_id values to point to new table
-- (Only if there are rows to update)
UPDATE user_credits uc
SET subscription_tier_id = migrate_tier_id(subscription_tier_id)
WHERE subscription_tier_id IS NOT NULL;

-- Step 4c: Add new foreign key pointing to subscription_tiers_new
ALTER TABLE user_credits
ADD CONSTRAINT user_credits_subscription_tier_id_fkey
FOREIGN KEY (subscription_tier_id) REFERENCES subscription_tiers_new(id)
ON DELETE SET NULL;

-- Step 4d: Verify the changes
SELECT COUNT(*) FROM user_credits WHERE subscription_tier_id IS NOT NULL;

-- If everything looks good:
COMMIT;

-- If something went wrong:
-- ROLLBACK;
```

#### Step 5: Drop the Mapping Function

```sql
DROP FUNCTION IF EXISTS migrate_tier_id(uuid);
```

### Rollback Procedure

If something goes wrong, you can restore the original foreign keys:

```sql
-- Restore user_subscriptions FK
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_tier_id_fkey;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_tier_id_fkey
  FOREIGN KEY (tier_id) REFERENCES subscription_tiers(id) ON DELETE SET NULL;

-- Restore user_credits FK
ALTER TABLE user_credits DROP CONSTRAINT IF EXISTS user_credits_subscription_tier_id_fkey;
ALTER TABLE user_credits ADD CONSTRAINT user_credits_subscription_tier_id_fkey
  FOREIGN KEY (subscription_tier_id) REFERENCES subscription_tiers(id) ON DELETE SET NULL;
```

### Testing Checklist

After migration, test:

- [ ] Users can view their subscription status
- [ ] Users can purchase new subscriptions
- [ ] Credit allocation works correctly
- [ ] Billing cycles are tracked properly
- [ ] No orphaned tier_id references
- [ ] All foreign key constraints are valid

---

## Phase 2: Archive Legacy subscription_tiers Table

### Prerequisites

✅ Phase 1 must be completed successfully first!

### Migration Steps

```sql
-- Verify no foreign keys reference subscription_tiers
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name != 'subscription_tiers'
    AND kcu.column_name IN (
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'subscription_tiers'
    );

-- If result is empty, safe to archive:
ALTER TABLE subscription_tiers RENAME TO subscription_tiers_archive_20260115;

-- Optionally, you can rename subscription_tiers_new to subscription_tiers:
-- (But this is not strictly necessary and can wait)
-- ALTER TABLE subscription_tiers_new RENAME TO subscription_tiers;
```

### Export Archive Data

```sql
-- Export to CSV for backup
COPY subscription_tiers_archive_20260115 TO '/tmp/subscription_tiers_backup_20260115.csv' WITH CSV HEADER;
```

---

## Phase 3: Document Active Credit System

### Current Active System

The `user_credits` table uses **System 3: Ledger-Based Credits**

**Active Columns:**
- `subscription_credits` - Credits from monthly/annual subscriptions
- `purchased_credits` - Credits from one-time purchases (never expire)
- `event_credits` - Credits from event passes (time-limited)
- `subscription_sms_credits` - SMS credits from subscriptions
- `purchased_sms_credits` - SMS credits from purchases
- `event_sms_credits` - SMS credits from event passes

**Consumption Priority:**
1. Subscription credits (first)
2. Purchased credits (second)
3. Event credits (last)

**Functions:**
- `get_total_credits(user_id)` - Returns total available credits
- `consume_credit(user_id, amount)` - Consumes credits in priority order
- `add_purchased_credits(user_id, credits, stripe_session_id)` - Adds purchased credits

**Backed by:** `credit_ledger` table provides full audit trail

### Deprecated Columns (Do Not Use)

**System 1 (Legacy):**
- `images_limit` - DEPRECATED
- `images_used` - DEPRECATED
- `sms_limit` - DEPRECATED
- `sms_used` - DEPRECATED
- `reset_date` - DEPRECATED

**System 2 (Transitional):**
- `annual_credits_total` - DEPRECATED (use subscription_credits instead)
- `annual_credits_used` - DEPRECATED (tracked in credit_ledger)

### Application Code Guidelines

```typescript
// ✅ CORRECT - Use System 3 columns
const totalCredits = subscription_credits + purchased_credits + event_credits;

// ❌ WRONG - Don't use legacy columns
const totalCredits = images_limit - images_used; // DEPRECATED
```

---

## Phase 4: Create Database Views (Future Enhancement)

To abstract the complexity of the credit system, consider creating views:

```sql
CREATE OR REPLACE VIEW user_credit_summary AS
SELECT
    user_id,
    subscription_credits,
    purchased_credits,
    event_credits,
    subscription_sms_credits,
    purchased_sms_credits,
    event_sms_credits,
    (subscription_credits + purchased_credits + event_credits) AS total_image_credits,
    (subscription_sms_credits + purchased_sms_credits + event_sms_credits) AS total_sms_credits,
    subscription_tier_id,
    plan_type,
    billing_period_start,
    billing_period_end,
    created_at,
    updated_at
FROM user_credits;

-- Grant access
GRANT SELECT ON user_credit_summary TO authenticated;
```

Application code can then use `user_credit_summary` instead of direct table access.

---

## Phase 5: Enable RLS Review (Security Check)

Verify all tables have proper RLS policies:

```sql
-- Check tables without RLS enabled
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
    SELECT tablename
    FROM pg_policies
)
ORDER BY tablename;

-- Should return empty result for production tables
```

---

## Phase 6: Verify Database Branching

After completing Phase 1 and 2, test database branching:

1. Go to Supabase Dashboard
2. Navigate to Database → Branching
3. Attempt to create a new branch
4. Verify no foreign key constraint errors

---

## Timeline & Dependencies

```
Phase 1 (Critical)
└── Update Foreign Keys
    ├── Duration: 2-4 hours (including testing)
    ├── Risk: Medium
    └── Rollback: Yes (automatic via transaction)

Phase 2 (High Priority)
└── Archive Legacy Table
    ├── Duration: 1 hour
    ├── Risk: Low (if Phase 1 completed)
    ├── Dependencies: Phase 1 MUST be complete
    └── Rollback: Yes (rename back)

Phase 3 (Documentation)
└── Document Active System
    ├── Duration: Already completed ✅
    ├── Risk: None
    └── Rollback: N/A

Phase 4 (Enhancement)
└── Create Database Views
    ├── Duration: 2-3 hours
    ├── Risk: Low
    ├── Dependencies: Phase 1 & 2 complete
    └── Rollback: DROP VIEW

Phase 5 (Security)
└── RLS Review
    ├── Duration: 1 hour
    ├── Risk: Low
    └── Rollback: N/A (review only)

Phase 6 (Verification)
└── Test Database Branching
    ├── Duration: 30 minutes
    ├── Risk: None
    └── Dependencies: All phases complete
```

---

## Success Criteria

The cleanup is successful when:

- [x] Comprehensive schema documentation exists
- [ ] All foreign keys point to canonical tables (subscription_tiers_new, not subscription_tiers)
- [ ] Legacy subscription_tiers table is archived
- [ ] Active credit system is clearly documented
- [ ] Database branching works without errors
- [ ] All tests pass
- [ ] No production issues reported for 30 days

---

## Support

**Before Starting:**
1. Create full database backup
2. Test on staging environment first
3. Schedule maintenance window for production

**If Issues Occur:**
1. Use transaction ROLLBACK immediately
2. Review error messages carefully
3. Check foreign key constraint errors
4. Consult DATABASE_SCHEMA.md for reference
5. Use rollback procedures provided above

**Emergency Rollback:**
All changes in Phase 1 and 2 are reversible. See "Rollback Procedure" sections above.

---

**Document Version:** 1.0
**Last Updated:** January 15, 2026
**Next Review:** After Phase 1 completion
