# Stripe Setup Guide for Fun Frame Photo AI

This guide provides step-by-step instructions for completing your Stripe integration to enable payments for subscriptions, event passes, and credit top-ups.

## Prerequisites

- A Stripe account (create at https://dashboard.stripe.com/register)
- Admin access to your Supabase project
- Your application deployed and accessible

---

## Part 1: Get Your Stripe API Keys

### Step 1: Sign in to Stripe Dashboard

1. Go to https://dashboard.stripe.com
2. Sign in to your account (or create one if needed)

### Step 2: Copy Your API Keys

1. Navigate to **Developers** > **API Keys**
2. Copy the following keys:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)
   - **Keep these secure - never commit to your repository**

### Step 3: Get Your Webhook Signing Secret (we'll set this up later)

You'll get this after creating the webhook endpoint in Part 4.

---

## Part 2: Configure Stripe Webhooks

### Step 1: Create Webhook Endpoint

1. In Stripe Dashboard, go to **Developers** > **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to:
   ```
   https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook
   ```
   Replace `<your-project-ref>` with your Supabase project reference ID

### Step 2: Select Events to Listen For

Select these events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Step 3: Copy Webhook Signing Secret

After creating the webhook, you'll see a **Signing secret** (starts with `whsec_`). Copy this - you'll need it in Part 3.

---

## Part 3: Store API Keys in Supabase

You need to store your Stripe keys as secrets in Supabase Edge Functions:

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** > **Secrets**
3. Add these secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `STRIPE_SECRET_KEY` | Your Stripe secret key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Your webhook signing secret | `whsec_...` |

**Note**: The publishable key (`pk_test_...`) is already configured in your `.env` file as `VITE_STRIPE_PUBLISHABLE_KEY`.

---

## Part 4: Create Products in Stripe

You need to create products in Stripe for each tier, event pass, and credit pack. **Metadata is critical** - it tells your application how to handle each product.

### A. Monthly Subscription Products

Create 4 monthly subscription products with these exact specifications:

#### 1. Starter Monthly
- **Name**: `Starter Monthly`
- **Description**:
  ```
  60 AI image generations per month
  50 SMS messages per month
  3 prompt slots per event
  1 concurrent event
  Basic support
  Monthly reset
  ```
- **Pricing**: Recurring, Monthly, **$29.00 USD**
- **Metadata** (click "Add metadata"):
  ```
  type: subscription
  tier: starter
  billing_period: monthly
  credits_per_period: 60
  sms_credits_per_period: 50
  prompts_limit: 3
  concurrent_events: 1
  display_order: 10
  ```

#### 2. Pro Monthly
- **Name**: `Pro Monthly`
- **Description**:
  ```
  200 AI image generations per month
  150 SMS messages per month
  6 prompt slots per event
  1 concurrent event
  Priority support
  Monthly reset
  ```
- **Pricing**: Recurring, Monthly, **$79.00 USD**
- **Metadata**:
  ```
  type: subscription
  tier: pro
  billing_period: monthly
  credits_per_period: 200
  sms_credits_per_period: 150
  prompts_limit: 6
  concurrent_events: 1
  display_order: 20
  ```

#### 3. Premium Monthly
- **Name**: `Premium Monthly`
- **Description**:
  ```
  450 AI image generations per month
  300 SMS messages per month
  9 prompt slots per event
  1 concurrent event
  Priority support
  Advanced features
  Monthly reset
  ```
- **Pricing**: Recurring, Monthly, **$149.00 USD**
- **Metadata**:
  ```
  type: subscription
  tier: premium
  billing_period: monthly
  credits_per_period: 450
  sms_credits_per_period: 300
  prompts_limit: 9
  concurrent_events: 3
  display_order: 30
  ```

#### 4. Platinum Monthly
- **Name**: `Platinum Monthly`
- **Description**:
  ```
  1,000 AI image generations per month
  750 SMS messages per month
  12 prompt slots per event
  1 concurrent event
  Dedicated support
  All features
  Monthly reset
  ```
- **Pricing**: Recurring, Monthly, **$299.00 USD**
- **Metadata**:
  ```
  type: subscription
  tier: platinum
  billing_period: monthly
  credits_per_period: 1000
  sms_credits_per_period: 750
  prompts_limit: 12
  concurrent_events: 1
  display_order: 40
  ```

---

### B. Annual Subscription Products

Create 4 annual subscription products:

#### 1. Starter Annual
- **Name**: `Starter Annual`
- **Description**:
  ```
  720 AI image generations per year
  720 SMS messages per year
  ~60 images per month
  ~50 SMS per month
  3 prompt slots per event
  1 concurrent event
  Basic support
  Save with annual billing
  ```
- **Pricing**: Recurring, Yearly, **$299.00 USD**
- **Metadata**:
  ```
  type: subscription
  tier: starter
  billing_period: annual
  credits_per_period: 720
  sms_credits_per_period: 600
  prompts_limit: 3
  concurrent_events: 1
  display_order: 10
  ```

#### 2. Pro Annual
- **Name**: `Pro Annual`
- **Description**:
  ```
  2,400 AI image generations per year
  1,800 SMS messages per year
  ~200 images per month
  ~150 SMS per month
  6 prompt slots per event
  1 concurrent event
  Priority support
  Save with annual billing
  ```
- **Pricing**: Recurring, Yearly, **$799.00 USD**
- **Metadata**:
  ```
  type: subscription
  tier: pro
  billing_period: annual
  credits_per_period: 2400
  sms_credits_per_period: 1800
  prompts_limit: 6
  concurrent_events: 2
  display_order: 20
  ```

#### 3. Premium Annual
- **Name**: `Premium Annual`
- **Description**:
  ```
  5,400 AI image generations per year
  3,600 SMS messages per year
  ~450 images per month
  ~300 SMS per month
  9 prompt slots per event
  1 concurrent event
  Priority support
  Advanced features
  Save with annual billing
  ```
- **Pricing**: Recurring, Yearly, **$1,499.00 USD**
- **Metadata**:
  ```
  type: subscription
  tier: premium
  billing_period: annual
  credits_per_period: 5400
  sms_credits_per_period: 3600
  prompts_limit: 9
  concurrent_events: 1
  display_order: 30
  ```

#### 4. Platinum Annual
- **Name**: `Platinum Annual`
- **Description**:
  ```
  12,000 AI image generations per year
  9,000 SMS messages per year
  ~1,000 images per month
  ~750 SMS per month
  12 prompt slots per event
  1 concurrent event
  Dedicated support
  All features
  Save with annual billing
  ```
- **Pricing**: Recurring, Yearly, **$2,999.00 USD**
- **Metadata**:
  ```
  type: subscription
  tier: platinum
  billing_period: annual
  credits_per_period: 12000
  sms_credits_per_period: 9000
  prompts_limit: 12
  concurrent_events: 1
  display_order: 40
  ```

---

### C. Activation Plans (Enterprise Subscriptions)

Create 2 activation plan products:

#### 1. Activation 2.5K
- **Name**: `Activation 2.5K`
- **Description**:
  ```
  2,500 AI image generations per month
  2,000 SMS messages per month
  Up to 5 concurrent events
  Unlimited prompts
  Deterministic seeds
  Priority queue
  Always-on event access
  ```
- **Pricing**: Recurring, Monthly, **$699.00 USD**
- **Metadata**:
  ```
  type: subscription
  tier: activation_2.5k
  billing_period: monthly
  credits_per_period: 2500
  sms_credits_per_period: 2000
  prompts_limit: 0
  concurrent_events: 5
  deterministic_seeds: true
  priority_queue: true
  display_order: 100
  ```

#### 2. Activation 5K
- **Name**: `Activation 5K`
- **Description**:
  ```
  5,000 AI image generations per month
  4,000 SMS messages per month
  Unlimited concurrent events
  Unlimited prompts
  Deterministic seeds
  Brand controls
  Team accounts
  Highest priority queue
  Always-on event access
  Dedicated support
  ```
- **Pricing**: Recurring, Monthly, **$1,299.00 USD**
- **Metadata**:
  ```
  type: subscription
  tier: activation_5k
  billing_period: monthly
  credits_per_period: 5000
  sms_credits_per_period: 4000
  prompts_limit: 0
  concurrent_events: 999
  deterministic_seeds: true
  priority_queue: true
  brand_controls: true
  team_accounts: true
  display_order: 101
  ```

---

### D. Event Pass Products

Create 4 event pass products:

#### 1. Starter Event
- **Name**: `Starter Event`
- **Description**:
  ```
  100 AI image generations
  150 SMS messages
  24-hour access
  3 custom prompts
  Best for small parties, private events
  ```
- **Pricing**: One-time, **$150.00 USD**
- **Metadata**:
  ```
  type: event_pass
  credits: 100
  sms_credits: 150
  duration_hours: 24
  prompts_limit: 3
  display_order: 1
  ```

#### 2. Pro Event
- **Name**: `Pro Event`
- **Description**:
  ```
  200 AI image generations
  300 SMS messages
  48-hour access
  6 custom prompts
  Best for weddings, corporate mixers
  ```
- **Pricing**: One-time, **$280.00 USD**
- **Metadata**:
  ```
  type: event_pass
  credits: 200
  sms_credits: 300
  duration_hours: 48
  prompts_limit: 6
  display_order: 2
  ```

#### 3. Premium Event
- **Name**: `Premium Event`
- **Description**:
  ```
  400 AI image generations
  600 SMS messages
  72-hour access
  Unlimited custom prompts
  Best for large receptions, festivals
  ```
- **Pricing**: One-time, **$520.00 USD**
- **Metadata**:
  ```
  type: event_pass
  credits: 400
  sms_credits: 600
  duration_hours: 72
  prompts_limit: 0
  display_order: 3
  ```

#### 4. Platinum Event
- **Name**: `Platinum Event`
- **Description**:
  ```
  750 AI image generations
  1,200 SMS messages
  96-hour access
  Unlimited custom prompts
  Best for enterprise, brand activations
  ```
- **Pricing**: One-time, **$900.00 USD**
- **Metadata**:
  ```
  type: event_pass
  credits: 750
  sms_credits: 1200
  duration_hours: 96
  prompts_limit: 0
  display_order: 4
  ```

---

### E. Credit Top-up Products

Create 4 credit pack products:

#### 1. Small Boost
- **Name**: `Small Boost`
- **Description**: `120 image credits + 120 SMS credits - Emergency refill for light users - credits never expire`
- **Pricing**: One-time, **$49.00 USD**
- **Metadata**:
  ```
  type: credit_topup
  credits: 120
  sms_credits: 120
  display_order: 1
  ```

#### 2. Creator Pack
- **Name**: `Creator Pack`
- **Description**: `350 image credits + 350 SMS credits - Perfect for regular creators and small events - credits never expire`
- **Pricing**: One-time, **$129.00 USD**
- **Metadata**:
  ```
  type: credit_topup
  credits: 350
  sms_credits: 350
  display_order: 2
  ```

#### 3. Pro Boost
- **Name**: `Pro Boost`
- **Description**: `900 image credits + 900 SMS credits - Power users and multi-event support - credits never expire`
- **Pricing**: One-time, **$279.00 USD**
- **Metadata**:
  ```
  type: credit_topup
  credits: 900
  sms_credits: 900
  display_order: 3
  ```

#### 4. Power Pack
- **Name**: `Power Pack`
- **Description**: `1,800 image credits + 1,800 SMS credits - Agencies and high-volume usage - credits never expire`
- **Pricing**: One-time, **$499.00 USD**
- **Metadata**:
  ```
  type: credit_topup
  credits: 1800
  sms_credits: 1800
  display_order: 4
  ```

---

## Part 5: Sync Products to Your Database

After creating all products in Stripe, you need to sync them to your database.

### Option A: Automatic Sync (Recommended)

Your application includes a sync function that will automatically import products from Stripe.

1. Log in to your application as an admin
2. The sync happens automatically when you view the pricing page, OR
3. Call the sync function manually (see Option B below)

### Option B: Manual Sync via API

You can manually trigger a sync by calling the edge function:

```bash
curl -X POST 'https://<your-project-ref>.supabase.co/functions/v1/sync-stripe-products' \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

---

## Part 6: Test Your Integration

### Test with Stripe Test Mode

1. Ensure you're using **test mode** API keys (they start with `sk_test_` and `pk_test_`)
2. Use Stripe test card numbers:
   - Card Number: `4242 4242 4242 4242`
   - Expiration: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

### Test Purchase Flow

1. **Test Subscription Purchase**:
   - Go to "Manage Plan" in your application
   - Click "Subscribe" on any plan
   - Complete checkout with test card
   - Verify credits are added to your account

2. **Test Event Pass Purchase**:
   - Go to "Event Passes" tab
   - Click "Purchase Pass"
   - Complete checkout
   - Verify event credits are added

3. **Test Credit Top-up**:
   - Go to "Credit Top-ups" tab
   - Click "Buy Credits"
   - Complete checkout
   - Verify purchased credits are added

### Verify in Database

Check that credits were granted correctly:

```sql
-- Check your credits
SELECT * FROM user_credits WHERE user_id = 'your-user-id';

-- Check credit ledger
SELECT * FROM credit_ledger WHERE user_id = 'your-user-id' ORDER BY created_at DESC;
```

---

## Part 7: Go Live

Once testing is complete, switch to live mode:

1. In Stripe Dashboard, toggle from **Test mode** to **Live mode** (top-right)
2. Get your **live** API keys from Developers > API Keys
3. Create a **new webhook** for live mode (repeat Part 2)
4. Update your Supabase secrets with live keys:
   - `STRIPE_SECRET_KEY` → your live secret key
   - `STRIPE_WEBHOOK_SECRET` → your live webhook secret
5. Update your `.env` file with the live publishable key

---

## Credit System Overview

### How Credits Work

**1 Image Credit** = 1 AI image generation
**1 SMS Credit** = 1 outbound text message

### Credit Types

1. **Subscription Credits**: Reset monthly/annually, no rollover
2. **Purchased Credits**: Never expire, stack with subscriptions
3. **Event Credits**: Included with event passes

### Consumption Order

Credits are consumed in this order:
1. Subscription credits (use first)
2. Purchased credits (use second)
3. Event credits (use last)

### Important Rules

- Subscription credits do NOT roll over on renewal
- Purchased credits survive subscription cancellation
- All credits stack across types
- Image credits and SMS credits are tracked separately

---

## Troubleshooting

### Products Not Showing Up

- **Check metadata**: Ensure `type` field is set correctly
- **Verify active status**: Products must be marked "Active" in Stripe
- **Check prices**: Each product must have at least one active price
- **Run sync function**: Manually trigger the sync if automatic sync fails

### Webhook Errors

- **Signature validation failed**: Check your webhook secret is correct
- **404 on webhook URL**: Verify your Supabase project URL is correct
- **Events not received**: Check webhook is enabled and has correct events selected

### Credits Not Granted

- **Check webhook logs**: Go to Stripe Dashboard > Developers > Webhooks > Events
- **Verify metadata**: Ensure `credits`, `sms_credits`, and `credits_per_period` are set
- **Check edge function logs**: View logs in Supabase Dashboard > Edge Functions
- **Verify RLS policies**: Ensure database policies allow credit writes

### Payment Fails

- **Test mode**: Ensure you're using test card numbers in test mode
- **Insufficient funds**: In live mode, ensure card has sufficient funds
- **Currency mismatch**: All prices must be in USD
- **Check Stripe logs**: View detailed errors in Stripe Dashboard > Logs

---

## Security Checklist

- [ ] Never commit API keys to your repository
- [ ] Store secrets in Supabase Edge Function secrets, not .env
- [ ] Use HTTPS for all webhook endpoints
- [ ] Validate webhook signatures in your webhook handler
- [ ] Enable RLS policies on all credit-related tables
- [ ] Test thoroughly in test mode before going live
- [ ] Monitor Stripe Dashboard for unusual activity
- [ ] Set up fraud prevention rules in Stripe Dashboard

---

## Support Resources

- **Stripe Documentation**: https://stripe.com/docs
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Stripe Test Cards**: https://stripe.com/docs/testing
- **Webhook Testing**: https://stripe.com/docs/webhooks/test

---

## Quick Reference: Metadata Fields

### Subscriptions (Monthly/Annual)
```
type: subscription
tier: [starter|pro|premium|platinum|activation_2.5k|activation_5k]
billing_period: [monthly|annual]
credits_per_period: [number]
sms_credits_per_period: [number]
prompts_limit: [number] (0 = unlimited)
concurrent_events: [number]
display_order: [number]
```

### Activation Plans (Additional Fields)
```
deterministic_seeds: [true|false]
priority_queue: [true|false]
brand_controls: [true|false]
team_accounts: [true|false]
```

### Event Passes
```
type: event_pass
credits: [number]
sms_credits: [number]
duration_hours: [number]
prompts_limit: [number] (0 = unlimited)
display_order: [number]
```

### Credit Top-ups
```
type: credit_topup
credits: [number]
sms_credits: [number]
display_order: [number]
```

---

## Next Steps

After completing this setup:

1. Test all purchase flows thoroughly
2. Monitor webhook delivery in Stripe Dashboard
3. Verify credits are being granted correctly
4. Test credit consumption during image generation
5. Check that SMS credits are consumed when sending messages
6. Set up email notifications for purchases (optional)
7. Configure Stripe fraud prevention rules
8. Go live when ready!

---

**Total Products to Create**: 18 products
- 8 Standard Subscriptions (4 monthly + 4 annual)
- 2 Activation Plans
- 4 Event Passes
- 4 Credit Top-ups

**Estimated Setup Time**: 2-3 hours (first time), 45-60 minutes (experienced)

**Questions or issues?** Check the Stripe webhook logs first, then review the edge function logs in Supabase. Most issues are related to incorrect metadata or webhook configuration.
