# Stripe Testing Guide - Starter Monthly Package

This guide will help you set up and test the Stripe checkout for the Starter Monthly subscription package.

## 🚀 Quick Start

1. **Access the Test Interface**
   - Open: `http://localhost:5173/test-stripe.html` (or your deployed URL)
   - This provides a visual interface to test the Stripe integration

## 📋 Prerequisites

Before testing, ensure you have:

- ✅ Stripe account (test mode)
- ✅ Stripe test keys configured in environment variables
- ✅ Supabase project set up
- ✅ User account created and authenticated

## 🔧 Setup Steps

### Step 1: Create Stripe Product

1. **Go to Stripe Dashboard**
   - Visit: https://dashboard.stripe.com/test/products
   - Click **"+ Add Product"**

2. **Configure Product Details**
   ```
   Name: Starter Monthly
   Description: Perfect for small events and testing
   ```

3. **Set Product Metadata** (Important!)
   Click "Add metadata" and add these key-value pairs:
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
   ```
   Pricing model: Standard pricing
   Price: $29.00 USD
   Billing period: Monthly
   ```

5. **Save and Copy Price ID**
   - After saving, you'll see a Price ID (e.g., `price_1Abc...`)
   - **Copy this Price ID** - you'll need it next

### Step 2: Update Database

Run this SQL command in your Supabase SQL Editor:

```sql
UPDATE subscription_tiers_new
SET stripe_price_id = 'price_YOUR_PRICE_ID_HERE',
    stripe_product_id = 'prod_YOUR_PRODUCT_ID_HERE'
WHERE name = 'Starter'
  AND billing_period = 'monthly';
```

Replace:
- `price_YOUR_PRICE_ID_HERE` with your actual Price ID (e.g., `price_1ABC123...`)
- `prod_YOUR_PRODUCT_ID_HERE` with your Product ID (e.g., `prod_XYZ789...`)

### Step 3: Verify Configuration

```sql
-- Check if the Stripe IDs are set correctly
SELECT
  id,
  name,
  billing_period,
  price_cents,
  stripe_price_id,
  stripe_product_id,
  credits_per_period,
  sms_credits_per_period,
  is_active
FROM subscription_tiers_new
WHERE name = 'Starter' AND billing_period = 'monthly';
```

Expected result:
- `stripe_price_id` should be populated (starts with `price_`)
- `stripe_product_id` should be populated (starts with `prod_`)
- `is_active` should be `true`

## 🧪 Testing the Checkout

### Method 1: Using the Test Interface (Recommended)

1. **Open Test Page**
   ```
   http://localhost:5173/test-stripe.html
   ```

2. **Log in to Your Account**
   - Make sure you're authenticated
   - The page will show your auth status

3. **Click "Test Configuration"**
   - Verifies all settings are correct
   - Shows any missing configuration

4. **Click "Start Checkout (Test Mode)"**
   - Creates a Stripe checkout session
   - Redirects to Stripe's payment page

5. **Complete Test Payment**
   - Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Any ZIP code

6. **Verify Success**
   - You'll be redirected back with a success message
   - Check your Stripe Dashboard for the test subscription

### Method 2: Using the Main Application

1. **Log in to your account**
   ```
   http://localhost:5173/
   ```

2. **Open Subscription Manager**
   - Navigate to Settings or click on your profile
   - Click "Manage Subscription" or "Upgrade"

3. **Select Starter Monthly**
   - Click the "Subscribe" button
   - Follow the checkout flow

### Method 3: Direct API Test (Advanced)

```javascript
// Test checkout creation
const response = await fetch('https://YOUR_SUPABASE_URL/functions/v1/stripe-checkout', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_USER_TOKEN',
    'Content-Type': 'application/json',
    'apikey': 'YOUR_SUPABASE_ANON_KEY'
  },
  body: JSON.stringify({
    price_id: 'price_YOUR_PRICE_ID',
    mode: 'subscription',
    success_url: 'http://localhost:5173/?checkout=success',
    cancel_url: 'http://localhost:5173/?checkout=cancelled'
  })
});

const { sessionId, url } = await response.json();
console.log('Checkout URL:', url);
// Open url in browser or redirect
```

## 🔍 Troubleshooting

### Issue: "Stripe Price ID not configured"

**Solution:**
- Make sure you ran the UPDATE SQL command
- Verify the price ID starts with `price_`
- Check if the tier name and billing period match exactly

```sql
-- Check current configuration
SELECT name, billing_period, stripe_price_id
FROM subscription_tiers_new
WHERE name LIKE '%Starter%';
```

### Issue: "Not authenticated"

**Solution:**
- Log in to your account first
- Make sure your session is still valid
- Check browser console for auth errors

### Issue: "Failed to create checkout session"

**Possible causes:**
1. **Stripe secret key not configured**
   - Check Supabase edge function environment variables
   - Ensure `STRIPE_SECRET_KEY` is set

2. **Invalid Price ID**
   - Verify the Price ID exists in Stripe
   - Make sure you're using test mode keys with test prices

3. **Customer creation failed**
   - Check Supabase logs
   - Verify database permissions

### Issue: "Webhook not receiving events"

**Solution:**
- Configure Stripe webhooks in your Stripe Dashboard
- Webhook URL: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
- Events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

## 📊 Test Cards

Use these test cards in Stripe test mode:

| Card Number         | Description           |
|---------------------|----------------------|
| 4242 4242 4242 4242 | Successful payment   |
| 4000 0000 0000 0002 | Card declined        |
| 4000 0025 0000 3155 | Requires 3D Secure   |

- **Expiry:** Any future date (e.g., 12/34)
- **CVC:** Any 3 digits (e.g., 123)
- **ZIP:** Any 5 digits (e.g., 12345)

## ✅ Success Indicators

After a successful test checkout, you should see:

1. **In Stripe Dashboard**
   - New customer created
   - Active subscription
   - Payment succeeded

2. **In Database**
   - `stripe_customers` table has new entry
   - `stripe_subscriptions` table shows active subscription
   - User's `subscription_tier_id` updated to Starter
   - Credit balance updated with 60 image credits

3. **In Application**
   - User can access Starter tier features
   - Credit display shows 60 credits
   - Subscription status shows "Active"

## 🔐 Security Notes

- Never commit Stripe secret keys to version control
- Use test mode keys for development/testing
- Use live mode keys only in production
- Webhook signing secrets should be stored securely
- Validate all webhook signatures

## 📚 Additional Resources

- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Checkout Documentation](https://stripe.com/docs/checkout)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Webhook Testing with Stripe CLI](https://stripe.com/docs/stripe-cli)

## 🆘 Support

If you encounter issues:
1. Check the test interface logs
2. Review Supabase function logs
3. Check Stripe Dashboard logs
4. Verify database configuration
5. Test with different browsers

## 🎯 Next Steps

After successful testing:
1. Test other subscription tiers (Pro, Premium)
2. Test credit top-up purchases
3. Test event pass purchases
4. Set up production Stripe keys
5. Configure production webhook endpoint
6. Test subscription cancellation flow
7. Test subscription upgrade/downgrade
