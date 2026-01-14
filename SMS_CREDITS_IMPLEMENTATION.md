# SMS Credits Implementation

## Overview

SMS credits are tracked separately from image credits and follow the same consumption order: **subscription → purchased → event**. Subscription SMS credits do NOT roll over on renewal.

## Database Schema

### New Columns Added

#### `user_credits` Table
- `subscription_sms_credits` - SMS credits from active subscription
- `purchased_sms_credits` - SMS credits from one-time purchases
- `event_sms_credits` - SMS credits from event passes
- `sms_used` - Total SMS messages sent

#### `subscription_tiers` Table
- `sms_credits_per_period` - SMS credits included per billing period

#### `credit_topup_products` Table
- `sms_credits` - SMS credits included in top-up pack

#### `event_passes` Table
- `sms_credits` - SMS credits included in event pass

#### `purchased_event_passes` Table
- `sms_credits_allocated` - SMS credits allocated to this pass
- `sms_credits_used` - SMS credits used from this pass

#### `credit_ledger` Table
- `sms_amount` - SMS credits in transaction
- `sms_balance_after` - SMS credit balance after transaction

## Database Functions

### `get_total_sms_credits(user_id)`
Returns the total available SMS credits for a user.

```sql
SELECT get_total_sms_credits('user-uuid-here');
```

### `consume_sms_credit(user_id, amount)`
Consumes SMS credits following the order: subscription → purchased → event.

```sql
SELECT consume_sms_credit('user-uuid-here', 1);
```

Returns:
```json
{
  "success": true,
  "consumed_from": "subscription",
  "amount": 1,
  "balance_after": 99
}
```

### `add_purchased_sms_credits(user_id, credits, session_id, payment_intent_id)`
Adds purchased SMS credits to a user's account.

```sql
SELECT add_purchased_sms_credits(
  'user-uuid-here',
  50,
  'cs_session_id',
  'pi_payment_intent_id'
);
```

## Stripe Product Metadata

### Subscription Products
Add to existing metadata:
- `sms_credits_per_period`: Number (e.g., `"10"`, `"50"`)

Example:
```
type: subscription
tier: pro
credits_per_period: 250
sms_credits_per_period: 25
```

### Credit Topup Products
Add to existing metadata:
- `sms_credits`: Number (e.g., `"10"`, `"25"`)

Example:
```
type: credit_topup
credits: 300
sms_credits: 30
```

### Event Pass Products
Add to existing metadata:
- `sms_credits`: Number (e.g., `"5"`, `"20"`)

Example:
```
type: event_pass
credits: 200
sms_credits: 10
duration_hours: 4
```

## Credit Behavior

### Consumption Order
1. Subscription SMS credits (resets each billing period)
2. Purchased SMS credits (never expire)
3. Event SMS credits (expire with the event pass)

### Subscription Renewals
- **NO ROLLOVER**: Unused subscription SMS credits are lost on renewal
- New SMS credits are granted based on `sms_credits_per_period`
- Purchased and event SMS credits are preserved

### Event Passes
- SMS credits are granted immediately upon purchase
- Added to `event_sms_credits` in `user_credits`
- Tracked separately in `purchased_event_passes` table

### Credit Top-ups
- SMS credits are granted immediately upon purchase
- Added to `purchased_sms_credits` in `user_credits`
- Never expire

## Usage in Code

### Check SMS Credit Balance
```typescript
const { data, error } = await supabase
  .rpc('get_total_sms_credits', { p_user_id: userId });

console.log(`Available SMS credits: ${data}`);
```

### Consume SMS Credit
```typescript
const { data, error } = await supabase
  .rpc('consume_sms_credit', {
    p_user_id: userId,
    p_amount: 1
  });

if (data.success) {
  console.log(`Consumed from: ${data.consumed_from}`);
  console.log(`Remaining: ${data.balance_after}`);
} else {
  console.error(data.error);
}
```

### Check All Credit Types
```typescript
const { data, error } = await supabase
  .from('user_credits')
  .select('subscription_sms_credits, purchased_sms_credits, event_sms_credits, sms_used')
  .eq('user_id', userId)
  .single();

console.log('SMS Credits:', data);
```

## Webhook Processing

The Stripe webhook automatically handles SMS credit grants:

1. **Subscription Created/Renewed**: Grants `sms_credits_per_period` from tier
2. **Event Pass Purchased**: Grants `sms_credits` from pass metadata
3. **Credit Top-up Purchased**: Grants `sms_credits` from product metadata

All grants are logged in the `credit_ledger` table with:
- `source`: 'subscription', 'credit_pack', or 'event'
- `sms_amount`: Number of SMS credits granted
- `sms_balance_after`: Total SMS credits after grant
- `metadata.type`: 'sms'

## Migration Applied

Migration: `add_sms_credits_system.sql`
- Added all SMS credit columns
- Created SMS credit functions
- Added indexes for performance
- No new tables (uses existing RLS policies)
