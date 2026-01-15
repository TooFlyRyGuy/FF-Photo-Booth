# SMS Credits Technical Reference

This document provides technical reference for the SMS credits system implementation. For Stripe setup instructions, see `STRIPE_SETUP_GUIDE.md`.

## Overview

SMS credits are tracked separately from image credits. Both follow the same consumption order: **subscription → purchased → event**. Subscription SMS credits do NOT roll over on renewal.

---

## Database Schema

### Tables with SMS Credit Columns

#### `user_credits` Table
```sql
subscription_sms_credits INTEGER DEFAULT 0   -- SMS credits from active subscription
purchased_sms_credits INTEGER DEFAULT 0      -- SMS credits from one-time purchases
event_sms_credits INTEGER DEFAULT 0          -- SMS credits from event passes
sms_used INTEGER DEFAULT 0                   -- Total SMS messages sent
```

#### `subscription_tiers_new` Table
```sql
sms_credits_per_period INTEGER DEFAULT 0     -- SMS credits included per billing period
```

#### `credit_topup_products` Table
```sql
sms_credits INTEGER DEFAULT 0                -- SMS credits included in top-up pack
```

#### `event_passes` Table
```sql
sms_credits INTEGER DEFAULT 0                -- SMS credits included in event pass
```

#### `credit_ledger` Table
```sql
sms_amount INTEGER DEFAULT 0                 -- SMS credits in transaction
sms_balance_after INTEGER DEFAULT 0          -- SMS credit balance after transaction
```

---

## Database Functions

### `get_total_sms_credits(p_user_id UUID)`

Returns the total available SMS credits for a user.

**Usage:**
```sql
SELECT get_total_sms_credits('550e8400-e29b-41d4-a716-446655440000');
```

**Returns:** `INTEGER` - Total available SMS credits

**Implementation:**
```sql
CREATE OR REPLACE FUNCTION get_total_sms_credits(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(
    subscription_sms_credits + purchased_sms_credits + event_sms_credits,
    0
  )
  FROM user_credits
  WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;
```

---

### `consume_sms_credit(p_user_id UUID, p_amount INTEGER)`

Consumes SMS credits following the priority order: subscription → purchased → event.

**Usage:**
```sql
SELECT consume_sms_credit('550e8400-e29b-41d4-a716-446655440000', 1);
```

**Returns:** `JSONB`
```json
{
  "success": true,
  "consumed_from": "subscription",
  "amount": 1,
  "balance_after": 99
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Insufficient SMS credits",
  "balance_after": 0
}
```

**Implementation Details:**
- Uses row-level locking (`FOR UPDATE`) to prevent race conditions
- Consumes from subscription credits first
- Falls back to purchased credits if subscription is depleted
- Falls back to event credits as last resort
- Logs transaction to `credit_ledger` table
- Updates `sms_used` counter

---

### `add_purchased_sms_credits(p_user_id UUID, p_credits INTEGER, p_session_id TEXT, p_payment_intent_id TEXT)`

Adds purchased SMS credits to a user's account.

**Usage:**
```sql
SELECT add_purchased_sms_credits(
  '550e8400-e29b-41d4-a716-446655440000',
  50,
  'cs_test_session_id',
  'pi_test_payment_intent_id'
);
```

**Returns:** `JSONB`
```json
{
  "success": true,
  "credits_added": 50,
  "new_balance": 150
}
```

**Implementation Details:**
- Adds credits to `purchased_sms_credits` column
- Logs transaction to `credit_ledger` with source='credit_pack'
- Records Stripe session and payment intent IDs
- Uses row-level locking to prevent race conditions

---

## TypeScript Integration

### Check SMS Credit Balance

```typescript
import { supabase } from './lib/supabase';

async function getSmsCreditBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .rpc('get_total_sms_credits', { p_user_id: userId });

  if (error) {
    console.error('Error fetching SMS credits:', error);
    return 0;
  }

  return data || 0;
}
```

---

### Consume SMS Credit

```typescript
async function consumeSmsCredit(userId: string, amount: number = 1) {
  const { data, error } = await supabase
    .rpc('consume_sms_credit', {
      p_user_id: userId,
      p_amount: amount
    });

  if (error) {
    console.error('Error consuming SMS credit:', error);
    return { success: false, error: error.message };
  }

  if (data.success) {
    console.log(`Consumed ${amount} SMS credit(s) from: ${data.consumed_from}`);
    console.log(`Remaining balance: ${data.balance_after}`);
  } else {
    console.error(`Failed to consume SMS credit: ${data.error}`);
  }

  return data;
}
```

---

### Check All Credit Types

```typescript
async function getAllCreditBalances(userId: string) {
  const { data, error } = await supabase
    .from('user_credits')
    .select('subscription_sms_credits, purchased_sms_credits, event_sms_credits, sms_used')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching credit breakdown:', error);
    return null;
  }

  return {
    subscription: data.subscription_sms_credits,
    purchased: data.purchased_sms_credits,
    event: data.event_sms_credits,
    used: data.sms_used,
    total: data.subscription_sms_credits + data.purchased_sms_credits + data.event_sms_credits
  };
}
```

---

## Stripe Webhook Processing

The Stripe webhook (`stripe-webhook` edge function) automatically handles SMS credit grants.

### Events Handled

1. **`checkout.session.completed`**
   - Credit top-ups: Grants `sms_credits` from product metadata
   - Event passes: Grants `sms_credits` from product metadata

2. **`invoice.payment_succeeded`**
   - Subscriptions: Grants `sms_credits_per_period` from tier metadata

3. **`customer.subscription.created`**
   - New subscriptions: Grants `sms_credits_per_period`

4. **`customer.subscription.updated`**
   - Subscription renewals: Resets `subscription_sms_credits` (no rollover)
   - Subscription upgrades: Grants difference in credits

### Metadata Required

#### Subscription Products
```json
{
  "type": "subscription",
  "tier": "pro",
  "credits_per_period": "200",
  "sms_credits_per_period": "150"
}
```

#### Credit Top-up Products
```json
{
  "type": "credit_topup",
  "credits": "300",
  "sms_credits": "30"
}
```

#### Event Pass Products
```json
{
  "type": "event_pass",
  "credits": "200",
  "sms_credits": "10"
}
```

---

## Credit Ledger Logging

All SMS credit transactions are logged to the `credit_ledger` table:

```sql
INSERT INTO credit_ledger (
  user_id,
  source,
  sms_amount,
  sms_balance_after,
  description,
  metadata
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'credit_pack',
  300,
  450,
  'Purchased SMS credits',
  '{"type": "sms", "product": "Creator Pack"}'::jsonb
);
```

### Source Types
- `subscription` - Credits from subscription renewal/creation
- `credit_pack` - Credits from one-time purchase
- `event` - Credits from event pass purchase
- `admin_grant` - Credits manually granted by admin
- `consumption` - Credits consumed (negative amount)

---

## Credit Behavior Rules

### Consumption Order
1. **Subscription SMS credits** (use first)
2. **Purchased SMS credits** (use second)
3. **Event SMS credits** (use last)

### Subscription Renewals
- **NO ROLLOVER**: Unused subscription SMS credits are lost
- New SMS credits granted = `sms_credits_per_period`
- Purchased and event SMS credits are preserved

### Event Passes
- SMS credits granted immediately upon purchase
- Added to `event_sms_credits`
- Expire when event pass expires (tracked separately)

### Credit Top-ups
- SMS credits granted immediately upon purchase
- Added to `purchased_sms_credits`
- **Never expire**

---

## Testing

### Test SMS Credit Consumption

```sql
-- Grant test credits
UPDATE user_credits
SET subscription_sms_credits = 10,
    purchased_sms_credits = 20,
    event_sms_credits = 5
WHERE user_id = 'your-user-id';

-- Test consumption
SELECT consume_sms_credit('your-user-id', 1);
-- Should consume from subscription first

SELECT consume_sms_credit('your-user-id', 15);
-- Should consume remaining 9 from subscription, then 6 from purchased

-- Check ledger
SELECT * FROM credit_ledger
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC;
```

### Test Credit Balance

```sql
-- Check total
SELECT get_total_sms_credits('your-user-id');

-- Check breakdown
SELECT subscription_sms_credits, purchased_sms_credits, event_sms_credits, sms_used
FROM user_credits
WHERE user_id = 'your-user-id';
```

---

## Row Level Security

All SMS credit tables have RLS policies:

- **Users** can view and update their own credits
- **Admins** can view and modify all credits
- **Anonymous** users cannot access credit data
- **Service role** bypasses RLS for webhook processing

---

## Migration Reference

SMS credits were added in migration: `20260114075612_add_sms_credits_system.sql`

This migration added:
- SMS credit columns to all relevant tables
- `get_total_sms_credits()` function
- `consume_sms_credit()` function
- `add_purchased_sms_credits()` function
- Updated `get_credit_balance()` to include SMS
- Indexes for performance optimization

---

## Common Issues

### SMS Credits Not Granted After Purchase
- Check Stripe webhook logs for errors
- Verify product metadata includes `sms_credits` or `sms_credits_per_period`
- Ensure webhook secret is configured correctly
- Check edge function logs in Supabase Dashboard

### Consumption Failing
- Verify user has sufficient SMS credits
- Check for RLS policy issues
- Ensure `consume_sms_credit` function exists
- Check for concurrent consumption (race condition)

### Credits Not Visible in UI
- Verify `get_total_sms_credits()` function returns correct value
- Check that UI is calling the function with correct user_id
- Ensure RLS policies allow user to read their own credits

---

## Performance Considerations

- All credit functions use `SECURITY DEFINER` to bypass RLS
- Row-level locking prevents race conditions during consumption
- Indexes exist on `user_id` for fast lookups
- Credit ledger is append-only for audit trail

---

For Stripe setup and product configuration, see **STRIPE_SETUP_GUIDE.md**.
