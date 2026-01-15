# Stripe Setup Quick Start Checklist

Use this checklist to complete your Stripe integration. For detailed instructions, see `STRIPE_SETUP_GUIDE.md`.

---

## ✅ Pre-Setup

- [ ] You have a Stripe account (sign up at https://dashboard.stripe.com/register)
- [ ] You have admin access to your Supabase project
- [ ] Your application is deployed and accessible

---

## ✅ Part 1: API Keys

- [ ] Sign in to Stripe Dashboard
- [ ] Navigate to **Developers** > **API Keys**
- [ ] Copy your **Publishable key** (starts with `pk_test_`)
- [ ] Copy your **Secret key** (starts with `sk_test_`)
- [ ] Store keys securely (never commit to repository)

---

## ✅ Part 2: Webhook Setup

- [ ] Go to **Developers** > **Webhooks** in Stripe
- [ ] Click **Add endpoint**
- [ ] Set URL to: `https://<your-project>.supabase.co/functions/v1/stripe-webhook`
- [ ] Select these events:
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.paid`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
- [ ] Copy the **Signing secret** (starts with `whsec_`)

---

## ✅ Part 3: Configure Supabase Secrets

- [ ] Go to Supabase Dashboard > **Edge Functions** > **Secrets**
- [ ] Add secret: `STRIPE_SECRET_KEY` = `sk_test_...`
- [ ] Add secret: `STRIPE_WEBHOOK_SECRET` = `whsec_...`
- [ ] Update `.env` file with publishable key: `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`

---

## ✅ Part 4: Create Stripe Products

### Monthly Subscriptions (4 products)

- [ ] **Starter Monthly** - $29/mo
  - Metadata: `type: subscription`, `tier: starter`, `billing_period: monthly`, `credits_per_period: 60`, `sms_credits_per_period: 50`, `prompts_limit: 3`, `concurrent_events: 1`, `display_order: 10`

- [ ] **Pro Monthly** - $79/mo
  - Metadata: `type: subscription`, `tier: pro`, `billing_period: monthly`, `credits_per_period: 200`, `sms_credits_per_period: 150`, `prompts_limit: 6`, `concurrent_events: 1`, `display_order: 20`

- [ ] **Premium Monthly** - $149/mo
  - Metadata: `type: subscription`, `tier: premium`, `billing_period: monthly`, `credits_per_period: 450`, `sms_credits_per_period: 300`, `prompts_limit: 9`, `concurrent_events: 2`, `display_order: 30`

- [ ] **Platinum Monthly** - $299/mo
  - Metadata: `type: subscription`, `tier: platinum`, `billing_period: monthly`, `credits_per_period: 1000`, `sms_credits_per_period: 750`, `prompts_limit: 12`, `concurrent_events: 2`, `display_order: 40`

### Annual Subscriptions (4 products)

- [ ] **Starter Annual** - $299/yr
  - Metadata: `type: subscription`, `tier: starter`, `billing_period: annual`, `credits_per_period: 720`, `sms_credits_per_period: 600`, `prompts_limit: 3`, `concurrent_events: 1`, `display_order: 10`

- [ ] **Pro Annual** - $799/yr
  - Metadata: `type: subscription`, `tier: pro`, `billing_period: annual`, `credits_per_period: 2400`, `sms_credits_per_period: 1800`, `prompts_limit: 6`, `concurrent_events: 1`, `display_order: 20`

- [ ] **Premium Annual** - $1499/yr
  - Metadata: `type: subscription`, `tier: premium`, `billing_period: annual`, `credits_per_period: 5400`, `sms_credits_per_period: 3600`, `prompts_limit: 9`, `concurrent_events: 1`, `display_order: 30`

- [ ] **Platinum Annual** - $2999/yr
  - Metadata: `type: subscription`, `tier: platinum`, `billing_period: annual`, `credits_per_period: 12000`, `sms_credits_per_period: 9000`, `prompts_limit: 12`, `concurrent_events: 1`, `display_order: 40`

### Activation Plans (2 products)

- [ ] **Activation 2.5K** - $699/mo
  - Metadata: `type: subscription`, `tier: activation_2.5k`, `billing_period: monthly`, `credits_per_period: 2500`, `sms_credits_per_period: 2000`, `prompts_limit: 0`, `concurrent_events: 5`, `deterministic_seeds: true`, `priority_queue: true`, `display_order: 100`

- [ ] **Activation 5K** - $1299/mo
  - Metadata: `type: subscription`, `tier: activation_5k`, `billing_period: monthly`, `credits_per_period: 5000`, `sms_credits_per_period: 4000`, `prompts_limit: 0`, `concurrent_events: 999`, `deterministic_seeds: true`, `priority_queue: true`, `brand_controls: true`, `team_accounts: true`, `display_order: 101`

### Event Passes (4 products)

- [ ] **Starter Event** - $150
  - Metadata: `type: event_pass`, `credits: 100`, `sms_credits: 150`, `duration_hours: 24`, `prompts_limit: 3`, `display_order: 1`

- [ ] **Pro Event** - $280
  - Metadata: `type: event_pass`, `credits: 200`, `sms_credits: 300`, `duration_hours: 48`, `prompts_limit: 6`, `display_order: 2`

- [ ] **Premium Event** - $520
  - Metadata: `type: event_pass`, `credits: 400`, `sms_credits: 600`, `duration_hours: 72`, `prompts_limit: 0`, `display_order: 3`

- [ ] **Platinum Event** - $900
  - Metadata: `type: event_pass`, `credits: 750`, `sms_credits: 1200`, `duration_hours: 96`, `prompts_limit: 0`, `display_order: 4`

### Credit Top-ups (4 products)

- [ ] **Small Boost** - $49
  - Metadata: `type: credit_topup`, `credits: 120`, `sms_credits: 120`, `display_order: 1`

- [ ] **Creator Pack** - $129
  - Metadata: `type: credit_topup`, `credits: 350`, `sms_credits: 350`, `display_order: 2`

- [ ] **Pro Boost** - $279
  - Metadata: `type: credit_topup`, `credits: 900`, `sms_credits: 900`, `display_order: 3`

- [ ] **Power Pack** - $499
  - Metadata: `type: credit_topup`, `credits: 1800`, `sms_credits: 1800`, `display_order: 4`

---

## ✅ Part 5: Sync Products

- [ ] Log in to your application as admin
- [ ] Navigate to "Manage Plan" page
- [ ] Products sync automatically, OR
- [ ] Manually call: `POST /functions/v1/sync-stripe-products`

---

## ✅ Part 6: Test Integration

### Test Subscription
- [ ] Click "Subscribe" on a plan
- [ ] Use test card: `4242 4242 4242 4242`
- [ ] Complete checkout
- [ ] Verify credits added to account
- [ ] Check credit ledger for transaction

### Test Event Pass
- [ ] Go to "Event Passes" tab
- [ ] Click "Purchase Pass"
- [ ] Use test card
- [ ] Verify event credits added

### Test Credit Top-up
- [ ] Go to "Credit Top-ups" tab
- [ ] Click "Buy Credits"
- [ ] Use test card
- [ ] Verify purchased credits added

### Verify in Database
- [ ] Check `user_credits` table for your user
- [ ] Check `credit_ledger` for transaction logs
- [ ] Verify webhook events in Stripe Dashboard

---

## ✅ Part 7: Go Live (When Ready)

- [ ] Switch Stripe Dashboard to **Live mode**
- [ ] Get live API keys (Developers > API Keys)
- [ ] Create new webhook endpoint for live mode
- [ ] Update Supabase secrets with live keys:
  - [ ] `STRIPE_SECRET_KEY` → live secret key
  - [ ] `STRIPE_WEBHOOK_SECRET` → live webhook secret
- [ ] Update `.env` with live publishable key
- [ ] Test with real card (small amount)
- [ ] Monitor webhook delivery
- [ ] Set up Stripe fraud prevention rules

---

## ✅ Security Checklist

- [ ] API keys are in Supabase secrets, not `.env` files
- [ ] Webhook endpoint uses HTTPS
- [ ] Webhook signature validation is enabled
- [ ] RLS policies are enabled on credit tables
- [ ] Test mode thoroughly before going live
- [ ] Stripe fraud rules configured
- [ ] Monitoring alerts set up

---

## 📋 Quick Reference

### Test Card Numbers
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Auth**: `4000 0027 6000 3184`

### Webhook Events to Monitor
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `customer.subscription.updated`

### Common Metadata Fields
- Subscriptions: `type`, `tier`, `billing_period`, `credits_per_period`, `sms_credits_per_period`, `prompts_limit`, `concurrent_events`
- Event Passes: `type`, `credits`, `sms_credits`, `duration_hours`, `prompts_limit`
- Credit Packs: `type`, `credits`, `sms_credits`

---

## 🆘 Troubleshooting

**Products not showing?**
- Check metadata `type` field is correct
- Verify products are marked "Active" in Stripe
- Run sync function manually

**Webhook failing?**
- Check signing secret is correct
- Verify webhook URL is correct
- Check edge function logs

**Credits not granted?**
- Check webhook received event
- Verify metadata field names
- Check edge function logs
- Verify RLS policies

---

## 📚 Full Documentation

- **Complete Setup Guide**: `STRIPE_SETUP_GUIDE.md`
- **Pricing Structure**: `PRICING_STRUCTURE.md`
- **SMS Credits Reference**: `SMS_CREDITS_TECHNICAL_REFERENCE.md`
- **Stripe API Docs**: https://stripe.com/docs
- **Supabase Functions**: https://supabase.com/docs/guides/functions

---

**Total Products to Create**: 18 products (8 subscriptions + 2 activations + 4 event passes + 4 credit packs)

**Estimated Setup Time**: 2-3 hours (first time), 45-60 minutes (experienced)

**When You're Done**: You'll have a fully functional payment system with subscriptions, activation plans, event passes, and credit top-ups!
