# Stripe Checkout Status - Starter Monthly Package

## ✅ Completed Setup

### 1. Test Interface Created
- **Location:** `/test-stripe.html`
- **Features:**
  - Visual configuration checker
  - One-click checkout test
  - Real-time logging
  - Auth status verification
  - Detailed setup instructions

### 2. Checkout Integration Updated
- **Component:** `components/SubscriptionManager.tsx`
- **Changes:**
  - Integrated real Stripe checkout flow
  - Supports subscriptions, event passes, add-ons, and credit top-ups
  - Proper error handling and user feedback
  - Automatic redirect to Stripe Checkout
  - Success/cancel URL handling

### 3. Database Ready
- **Table:** `subscription_tiers_new`
- **Starter Monthly Tier:**
  - ID: `37a99816-6d08-4dd1-80e5-72253c09b41f`
  - Name: Starter
  - Price: $29.00 ($2900 cents)
  - Credits: 60 image credits/month
  - SMS Credits: 50/month
  - Prompts Limit: 5 per event
  - Status: Active

### 4. Environment Configuration
- ✅ Stripe Publishable Key: Configured
- ✅ Supabase URL: Configured
- ✅ Supabase Anon Key: Configured
- ⚠️ Stripe Secret Key: Needs verification in Supabase environment

### 5. Edge Functions Deployed
- ✅ `stripe-checkout`: Creates checkout sessions
- ✅ `stripe-webhook`: Handles Stripe events
- ✅ `sync-stripe-products`: Syncs products from Stripe

## 🔧 Remaining Setup Required

### Step 1: Create Stripe Product (5 minutes)

1. **Login to Stripe Dashboard**
   ```
   https://dashboard.stripe.com/test/products
   ```

2. **Create Product**
   - Click "+ Add Product"
   - Name: `Starter Monthly`
   - Description: `Perfect for small events and testing`

3. **Add Metadata** (Critical!)
   ```
   type: subscription
   tier: starter
   credits_per_period: 60
   sms_credits_per_period: 50
   prompts_limit: 5
   rollover_enabled: false
   display_order: 1
   ```

4. **Create Price**
   - Amount: $29.00 USD
   - Billing: Monthly (recurring)
   - Currency: USD

5. **Copy IDs**
   - Product ID: `prod_...`
   - Price ID: `price_...`

### Step 2: Update Database (1 minute)

Run this SQL in Supabase SQL Editor:

```sql
UPDATE subscription_tiers_new
SET
  stripe_price_id = 'price_PASTE_YOUR_PRICE_ID_HERE',
  stripe_product_id = 'prod_PASTE_YOUR_PRODUCT_ID_HERE'
WHERE
  id = '37a99816-6d08-4dd1-80e5-72253c09b41f';

-- Verify the update
SELECT
  name,
  billing_period,
  price_cents,
  stripe_price_id,
  stripe_product_id
FROM subscription_tiers_new
WHERE name = 'Starter' AND billing_period = 'monthly';
```

### Step 3: Verify Stripe Secret Key

Check if the Stripe secret key is configured in Supabase:

1. Go to: Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Verify `STRIPE_SECRET_KEY` exists
3. If not, add it with your test secret key (starts with `sk_test_`)

## 🧪 Testing Instructions

### Quick Test (Recommended)

1. **Open Test Interface**
   ```
   http://localhost:5173/test-stripe.html
   ```
   Or deployed: `https://your-domain.com/test-stripe.html`

2. **Login First**
   - Make sure you're logged into the app
   - Test page will show auth status

3. **Click "Test Configuration"**
   - Verifies Stripe keys
   - Checks database configuration
   - Shows any missing setup

4. **Click "Start Checkout (Test Mode)"**
   - Creates checkout session
   - Redirects to Stripe payment page
   - Use test card: `4242 4242 4242 4242`

5. **Complete Payment**
   - Any future expiry date
   - Any 3-digit CVC
   - Any ZIP code

### Test from Main App

1. Login to your account
2. Navigate to Settings → Subscription
3. Click "Subscribe" on Starter Monthly
4. Complete checkout with test card

## 📊 Current Database State

```sql
-- Current Starter Monthly Configuration
{
  "id": "37a99816-6d08-4dd1-80e5-72253c09b41f",
  "name": "Starter",
  "billing_period": "monthly",
  "price_cents": 2900,
  "stripe_price_id": null,  ⚠️ NEEDS TO BE SET
  "stripe_product_id": null, ⚠️ NEEDS TO BE SET
  "credits_per_period": 60,
  "sms_credits_per_period": 50,
  "is_active": true
}
```

## 🔍 Verification Checklist

After setup, verify:

- [ ] Stripe product exists in dashboard
- [ ] Price ID populated in database
- [ ] Product ID populated in database
- [ ] Test checkout creates session successfully
- [ ] Redirects to Stripe Checkout page
- [ ] Test payment succeeds
- [ ] Webhook receives events
- [ ] User subscription updated
- [ ] Credits added to account

## 🎯 Test Cards

| Card Number         | Result            |
|---------------------|-------------------|
| 4242 4242 4242 4242 | Success           |
| 4000 0000 0000 0002 | Declined          |
| 4000 0025 0000 3155 | Requires 3D Auth  |

## 📝 Expected Flow

### Successful Checkout:
```
User clicks Subscribe
  ↓
App calls stripe-checkout function
  ↓
Stripe Checkout session created
  ↓
User redirected to Stripe
  ↓
User enters payment details
  ↓
Payment processed
  ↓
Stripe sends webhook events
  ↓
stripe-webhook function processes
  ↓
Database updated:
  - subscription_tier_id updated
  - credits added
  - subscription status set to active
  ↓
User redirected back to app
  ↓
Success page shown
```

## 🐛 Troubleshooting

### "Stripe Price ID not configured"
**Fix:** Complete Step 2 above (Update Database)

### "Failed to create checkout session"
**Check:**
1. Stripe secret key is set in Supabase
2. User is authenticated
3. Price ID is valid in Stripe dashboard

### "Not authenticated"
**Fix:** Log in to your account before testing

### Webhook not working
**Setup:**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

## 📚 Documentation

- **Full Setup Guide:** `STRIPE_TESTING_GUIDE.md`
- **Quick Start:** `STRIPE_SETUP_GUIDE.md`
- **Stripe Checklist:** `STRIPE_QUICK_START_CHECKLIST.md`
- **Test Interface:** `/test-stripe.html`

## 🚀 Next Steps After Testing

1. ✅ Test Starter Monthly (current task)
2. Create and test other tiers (Pro, Premium, Platinum)
3. Create and test credit top-up products
4. Create and test event passes
5. Test subscription management (cancel, upgrade, downgrade)
6. Set up production Stripe keys
7. Configure production webhooks
8. Test live payments with real cards

## 💡 Quick Commands

```bash
# Rebuild project
npm run build

# Start dev server
npm run dev

# Check Stripe configuration (in browser console)
fetch('/test-stripe.html').then(r => r.text()).then(console.log)

# Verify database (Supabase SQL Editor)
SELECT * FROM subscription_tiers_new WHERE name = 'Starter';
```

## ✨ What's Working Now

1. ✅ Credit check in Kiosk Mode (prevents photos without credits)
2. ✅ Warning screen for out of credits
3. ✅ Buttons to upgrade/purchase credits
4. ✅ Stripe checkout integration in SubscriptionManager
5. ✅ Test interface for easy validation
6. ✅ Comprehensive documentation
7. ✅ All edge functions deployed

## ⏱️ Time to Complete Setup: ~10 minutes

Just need to:
1. Create Stripe product (5 min)
2. Update database (1 min)
3. Test checkout (3 min)

Then you're ready to process real payments!
