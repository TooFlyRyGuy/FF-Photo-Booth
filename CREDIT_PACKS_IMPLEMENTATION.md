# Credit Pack System Implementation

## Overview

A comprehensive Stripe-driven credit pack system has been implemented across the entire AI Photo Booth application. Stripe is the single source of truth for all credit pack configurations.

## Implemented Features

### 1. Database Schema

#### Credit Ledger Table
- Logs all credit transactions (purchases, consumption, grants)
- Tracks source: `subscription`, `credit_pack`, `event`, `admin_grant`, `consumption`
- Links to Stripe sessions for complete audit trail
- Row-level security enabled

#### User Credits Table (Extended)
- `subscription_credits` - Credits from active subscriptions
- `purchased_credits` - Credits from one-time credit pack purchases
- `event_credits` - Credits from event passes

#### Credit Functions
- `get_total_credits(user_id)` - Returns total available credits
- `consume_credit(user_id, amount)` - Consumes credits in priority order
- `add_purchased_credits(user_id, credits, session_id, payment_intent_id)` - Adds purchased credits with logging

### 2. Authorized Credit Packs

Only these 4 credit packs are supported:

| Pack Name     | Credits | Expiration |
|---------------|---------|------------|
| Small Boost   | 100     | Never      |
| Creator Pack  | 300     | Never      |
| Pro Boost     | 750     | Never      |
| Power Pack    | 1,500   | Never      |

All other packs have been removed from the database.

### 3. Credit Consumption Logic

Credits are consumed in this order:
1. **Subscription Credits** (consumed first)
2. **Purchased Credits** (consumed second)
3. **Event Credits** (consumed last)

Rules:
- 1 credit = 1 image generation
- No fractional credits
- No refunds after generation starts
- Credits are stackable
- Purchased credits never expire
- Credits survive subscription cancellation

### 4. Stripe Integration

#### Webhook Handler
- Updated to handle `type: "credit_topup"` metadata
- Reads `credits_granted` from Stripe product metadata
- Logs all transactions to credit_ledger
- Supports both `purchase_type` and `type` metadata formats

#### Checkout Handler
- Automatically fetches Stripe product metadata
- Passes metadata to checkout session
- Handles one-time payment mode for credit packs

### 5. UI Components

#### CreditDisplay Component
- Shows total available credits
- Breaks down credits by type (subscription/purchased/event)
- Displays low balance warnings
- Explains consumption order
- Can be used in compact mode

#### CreditTopup Component
- Displays all active credit packs
- Integrates with Stripe checkout
- Shows credit pack benefits
- Handles purchase flow with proper error handling
- Displays Stripe configuration status

### 6. Credit Service
Located at `services/creditService.ts`:
- `getCreditBalance(userId)` - Fetches credit breakdown
- `consumeCredit(userId, amount)` - Consumes credits
- `addPurchasedCredits(userId, credits, ...)` - Adds credits
- `getCreditLedger(userId, limit)` - Fetches transaction history
- `getCreditTopupProducts()` - Lists available packs
- `checkCreditAvailability(userId)` - Validates credit availability

## Stripe Configuration Required

### Step 1: Create Products in Stripe

Create 4 products in your Stripe Dashboard (https://dashboard.stripe.com/products):

#### Product 1: Small Boost
- **Name**: Small Boost
- **Price**: Set your desired price (e.g., $4.99)
- **Product Metadata**:
  ```json
  {
    "type": "credit_topup",
    "credits_granted": "100",
    "expires": "never"
  }
  ```

#### Product 2: Creator Pack
- **Name**: Creator Pack
- **Price**: Set your desired price (e.g., $12.99)
- **Product Metadata**:
  ```json
  {
    "type": "credit_topup",
    "credits_granted": "300",
    "expires": "never"
  }
  ```

#### Product 3: Pro Boost
- **Name**: Pro Boost
- **Price**: Set your desired price (e.g., $29.99)
- **Product Metadata**:
  ```json
  {
    "type": "credit_topup",
    "credits_granted": "750",
    "expires": "never"
  }
  ```

#### Product 4: Power Pack
- **Name**: Power Pack
- **Price**: Set your desired price (e.g., $49.99)
- **Product Metadata**:
  ```json
  {
    "type": "credit_topup",
    "credits_granted": "1500",
    "expires": "never"
  }
  ```

### Step 2: Update Database

After creating the products in Stripe, update the database with the Stripe IDs:

```sql
-- Replace 'prod_xxx' and 'price_xxx' with your actual Stripe IDs

UPDATE credit_topup_products
SET
  stripe_product_id = 'prod_SmallBoostId',
  stripe_price_id = 'price_SmallBoostPriceId',
  price_cents = 499  -- $4.99 in cents
WHERE name = 'Small Boost';

UPDATE credit_topup_products
SET
  stripe_product_id = 'prod_CreatorPackId',
  stripe_price_id = 'price_CreatorPackPriceId',
  price_cents = 1299  -- $12.99 in cents
WHERE name = 'Creator Pack';

UPDATE credit_topup_products
SET
  stripe_product_id = 'prod_ProBoostId',
  stripe_price_id = 'price_ProBoostPriceId',
  price_cents = 2999  -- $29.99 in cents
WHERE name = 'Pro Boost';

UPDATE credit_topup_products
SET
  stripe_product_id = 'prod_PowerPackId',
  stripe_price_id = 'price_PowerPackPriceId',
  price_cents = 4999  -- $49.99 in cents
WHERE name = 'Power Pack';
```

### Step 3: Configure Webhook

Ensure your Stripe webhook is configured to send events to:
```
https://your-project.supabase.co/functions/v1/stripe-webhook
```

Required events:
- `checkout.session.completed`
- `invoice.payment_succeeded`

## How It Works

### Purchase Flow

1. User clicks "Purchase" on a credit pack
2. Frontend calls `stripe-checkout` edge function with `price_id`
3. Edge function fetches Stripe product metadata
4. Creates Stripe checkout session with metadata
5. User completes payment on Stripe
6. Stripe sends webhook to `stripe-webhook` edge function
7. Webhook reads `credits_granted` from metadata
8. Calls `add_purchased_credits()` database function
9. Credits are added to user's `purchased_credits`
10. Transaction logged to `credit_ledger`

### Consumption Flow

1. User generates an image in KioskMode
2. System calls `checkCreditAvailability(userId)`
3. If credits available, proceed to generation
4. After successful generation, call `consumeCredit(userId, 1)`
5. Credits consumed in order: subscription → purchased → event
6. Consumption logged to `credit_ledger`

### Credit Display

1. Component calls `getCreditBalance(userId)`
2. Returns breakdown:
   - `subscription_credits`
   - `purchased_credits`
   - `event_credits`
   - `total`
3. UI displays breakdown and total
4. Shows warnings if balance is low

## Security Features

- RLS policies on `credit_ledger` (users see own, admins see all)
- Database functions use row locking (`FOR UPDATE`)
- Atomic credit consumption prevents race conditions
- Webhook validates Stripe signatures
- All credit amounts read from Stripe metadata (not user input)

## Testing Checklist

- [ ] Credits stack correctly across types
- [ ] Credits persist across sessions
- [ ] Credits survive subscription cancellation
- [ ] Consumption order is correct (sub → purchased → event)
- [ ] Credit ledger logs all transactions
- [ ] Webhook handles credit_topup purchases
- [ ] No references to old/removed packs
- [ ] Image generation checks credits before proceeding
- [ ] UI displays credit breakdown correctly
- [ ] Purchased credits never expire
- [ ] Low balance warnings appear correctly

## Future Enhancements

- Email notification on credit purchase
- Credit gift cards
- Bulk credit purchase discounts
- Credit usage analytics dashboard
- Auto-top-up when balance is low

## Support

If you encounter issues:
1. Check Stripe webhook logs in Stripe Dashboard
2. Check edge function logs in Supabase Dashboard
3. Verify product metadata is correct in Stripe
4. Ensure `stripe_price_id` is set in database
5. Confirm webhook secret is configured correctly
