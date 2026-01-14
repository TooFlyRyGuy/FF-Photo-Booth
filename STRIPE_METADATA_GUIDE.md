# Stripe Product Metadata Guide

This guide shows exactly what metadata you need for each Stripe product type in your Fun Frame Photo AI application.

## Product Types Overview

| Product Type | Metadata `type` | Tables Synced To |
|--------------|----------------|------------------|
| Subscriptions | `subscription` | `subscription_tiers` |
| Credit Top-ups | `credit_topup` | `credit_topup_products` |
| Event Passes | `event_pass` | `event_passes` |
| Add-ons | `add_on` | `add_ons` |

---

## 1. Subscription Products

**Metadata field:** `type` = `"subscription"`

### Required Metadata
- `type`: `"subscription"`
- `tier`: `"starter"` | `"pro"` | `"premium"` | `"agency"`
- `credits_per_period`: Number of image credits (e.g., `"100"`, `"500"`)

### Optional Metadata
- `sms_credits_per_period`: Number of SMS credits (e.g., `"10"`, `"50"`)
- `prompts_limit`: Number of prompts (e.g., `"10"`)
- `rollover_enabled`: `"true"` | `"false"` (default: false)
- `display_order`: Number for sorting (e.g., `"1"`, `"2"`)

### Stripe Settings
- Set pricing as **recurring** (monthly or annual)
- Add features in the product **description** (one per line)
- The billing interval (monthly/annual) is detected automatically from the price

### Example Metadata
```
type: subscription
tier: pro
credits_per_period: 250
sms_credits_per_period: 25
prompts_limit: 10
display_order: 2
```

### Features (in description)
```
250 images per month
25 SMS messages per month
Hard cap - no overages
Priority support
```

### Important Notes
- **NO ROLLOVER**: Unused subscription credits (both image and SMS) are lost on renewal
- New credits are granted at the start of each billing period
- Purchased and event credits are preserved through renewals

---

## 2. Credit Topup Products

**Metadata field:** `type` = `"credit_topup"`

### Required Metadata
- `type`: `"credit_topup"`
- `credits`: Number of image credits (e.g., `"100"`, `"300"`, `"750"`, `"1500"`)

### Optional Metadata
- `sms_credits`: Number of SMS credits (e.g., `"10"`, `"30"`)
- `display_order`: Number for sorting (e.g., `"1"`, `"2"`)

### Stripe Settings
- Set pricing as **one-time payment**

### Example Metadata
```
type: credit_topup
credits: 300
sms_credits: 30
display_order: 2
```

### Official Credit Packs
```
Small Boost: 100 image credits
Creator Pack: 300 image credits
Pro Boost: 750 image credits
Power Pack: 1500 image credits
```

### Important Notes
- Credit top-ups NEVER expire
- Both image and SMS credits are added to `purchased_credits` / `purchased_sms_credits`
- Consumed after subscription credits but before event credits

---

## 3. Event Pass Products

**Metadata field:** `type` = `"event_pass"`

### Required Metadata
- `type`: `"event_pass"`
- `credits`: Number of image credits (e.g., `"200"`)
- `duration_hours`: Duration in hours (e.g., `"4"`, `"8"`)

### Optional Metadata
- `sms_credits`: Number of SMS credits (e.g., `"5"`, `"20"`)
- `setup_included`: `"true"` | `"false"`
- `prompts_limit`: Number of prompts (e.g., `"5"`)
- `display_order`: Number for sorting
- `expiration_hours`: Hours until expiration (e.g., `"24"`)

### Stripe Settings
- Set pricing as **one-time payment**
- Add features in the product **description** (one per line)

### Example Metadata
```
type: event_pass
credits: 200
sms_credits: 10
duration_hours: 4
setup_included: true
prompts_limit: 5
expiration_hours: 24
display_order: 1
```

### Features (in description)
```
200 AI-generated images
10 SMS messages
4 hours of event coverage
Setup included
5 custom prompts
```

### Important Notes
- Event credits are granted immediately upon purchase
- Credits expire when the event pass expires
- Can be assigned to a specific event
- Consumed last (after subscription and purchased credits)

---

## 4. Add-on Products

**Metadata field:** `type` = `"add_on"`

### Required Metadata
- `type`: `"add_on"`

### Optional Metadata
- `delivery_method`: `"zoom"` | `"phone"` | `"in_person"` (default: `"zoom"`)
- `duration_minutes`: Number (e.g., `"30"`, `"60"`)
- `calendly_link`: URL to Calendly scheduling page

### Stripe Settings
- Set pricing as **one-time payment**
- Add description in the product **description** field

### Example Metadata
```
type: add_on
delivery_method: zoom
duration_minutes: 60
calendly_link: https://calendly.com/yourcompany/setup-call
```

### Description Example
```
One-on-one setup call to configure your event settings, prompts, and branding. Includes post-event support.
```

---

## Credit Consumption Order

### Image Credits
1. **Subscription Credits** (reset each period, no rollover)
2. **Purchased Credits** (never expire)
3. **Event Credits** (expire with event pass)

### SMS Credits
1. **Subscription SMS Credits** (reset each period, no rollover)
2. **Purchased SMS Credits** (never expire)
3. **Event SMS Credits** (expire with event pass)

---

## Syncing Products from Stripe

### Automatic Sync via Webhook
Products are automatically synced when:
- A customer completes checkout
- A subscription is created or renewed
- Payment succeeds

### Manual Sync via API
Call the sync endpoint as an admin:

```bash
POST /functions/v1/sync-stripe-products
Authorization: Bearer YOUR_JWT_TOKEN
```

This will sync all active products from Stripe to your database.

---

## Metadata in Checkout Sessions

When creating checkout sessions, these metadata fields are used:

### For Event Passes
```javascript
metadata: {
  purchase_type: 'event_pass',
  event_pass_tier_id: 'uuid',
  event_id: 'uuid', // optional
  credits: '200',
  sms_credits: '10',
  prompt_limit: '5',
  expiration_hours: '24'
}
```

### For Credit Top-ups
```javascript
metadata: {
  purchase_type: 'credit_topup',
  credits_granted: '300',
  sms_credits_granted: '30'
}
```

---

## Testing Your Setup

1. Create products in Stripe with proper metadata
2. Run the sync function to import them
3. Verify in your database:

```sql
-- Check subscription tiers
SELECT name, credits_per_period, sms_credits_per_period
FROM subscription_tiers;

-- Check credit top-ups
SELECT name, credits, sms_credits
FROM credit_topup_products;

-- Check event passes
SELECT name, credits, sms_credits, duration_hours
FROM event_passes;

-- Check add-ons
SELECT name, price_cents, delivery_method
FROM add_ons;
```

---

## Common Issues

### Products Not Syncing
- Ensure the `type` metadata field is set correctly
- Check that products are marked as **Active** in Stripe
- Verify at least one active price exists
- Check logs in the sync function for errors

### Missing Credits
- Verify metadata field names match exactly (case-sensitive)
- Ensure values are strings in metadata: `"100"` not `100`
- Check webhook is receiving and processing events

### Wrong Credit Amounts
- Metadata must be strings: `credits: "300"` not `credits: 300`
- `parseInt()` is used to parse all numeric metadata
- Default is `0` if metadata is missing
