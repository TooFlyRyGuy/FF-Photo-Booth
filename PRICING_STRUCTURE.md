# Canonical Pricing Structure

**Last Updated:** January 15, 2026
**Status:** AUTHORITATIVE - This is the source of truth for all pricing

---

## 🔴 CRITICAL PRINCIPLES

### 1. **Stripe is the Source of Truth**
All prices must match Stripe product configuration exactly.

### 2. **Two Distinct Credit Systems - DO NOT MERGE**

#### Image Credits → AI Generation Fuel
- Used to generate AI images (1 credit = 1 image)
- Purchased through Credit Top-Ups
- Included in Event Passes
- Allocated monthly/annually via Subscriptions and Activations
- Never expire when purchased, reset monthly for subscriptions

#### SMS Credits → Delivery System
- Used to send photos via text message (1 credit = 1 SMS)
- Purchased through Credit Top-Ups
- Included in Event Passes
- Allocated monthly/annually via Subscriptions and Activations
- Never expire when purchased, reset monthly for subscriptions

---

## 💳 1. CREDIT TOP-UPS (Permanent Fuel)

**Purpose:** Provide non-expiring credits for image generation and SMS delivery

**Key Rules:**
- Credits never expire
- Can be used across any event
- Stack cumulatively with subscription credits
- Do not grant event creation rights

### Products

#### Small Boost - $49
```yaml
Price: $49.00 (4,900 cents)
Image Credits: 120
SMS Credits: 120
Expiration: Never
Use Case: Small events, trial customers
Stripe Metadata:
  type: credit_topup
  credits: 120
  sms_credits: 120
  display_order: 1
```

#### Creator Pack - $129
```yaml
Price: $129.00 (12,900 cents)
Image Credits: 350
SMS Credits: 350
Expiration: Never
Use Case: Medium events, regular users
Stripe Metadata:
  type: credit_topup
  credits: 350
  sms_credits: 350
  display_order: 2
```

#### Pro Boost - $279
```yaml
Price: $279.00 (27,900 cents)
Image Credits: 900
SMS Credits: 900
Expiration: Never
Use Case: Large events, power users
Stripe Metadata:
  type: credit_topup
  credits: 900
  sms_credits: 900
  display_order: 3
```

#### Power Pack - $499
```yaml
Price: $499.00 (49,900 cents)
Image Credits: 1,800
SMS Credits: 1,800
Expiration: Never
Use Case: Multiple events, agencies
Stripe Metadata:
  type: credit_topup
  credits: 1800
  sms_credits: 1800
  display_order: 4
```

---

## 🎟️ 2. EVENT PASSES (Time-Bound Access)

**Purpose:** Grant permission to create and host events with time-limited access

**Key Rules:**
- Required to create or activate events
- Expire at end of event window
- Include starter credits as buffers
- Can use additional Credit Top-Up credits during event

### Products

#### Starter Event - $150
```yaml
Price: $150.00 (15,000 cents)
Events Allowed: 1
Event Window: 24 hours
Prompt Limit: 3 prompts per event
Included Image Credits: 100
Included SMS Credits: 150
Best For: Small parties, private events
Stripe Metadata:
  type: event_pass
  credits: 100
  sms_credits: 150
  duration_hours: 24
  prompts_limit: 3
  display_order: 1
```

#### Pro Event - $280
```yaml
Price: $280.00 (28,000 cents)
Events Allowed: 1
Event Window: 48 hours
Prompt Limit: 6 prompts per event
Included Image Credits: 200
Included SMS Credits: 300
Best For: Weddings, corporate mixers
Stripe Metadata:
  type: event_pass
  credits: 200
  sms_credits: 300
  duration_hours: 48
  prompts_limit: 6
  display_order: 2
```

#### Premium Event - $520
```yaml
Price: $520.00 (52,000 cents)
Events Allowed: 1
Event Window: 72 hours
Prompt Limit: Unlimited (0)
Included Image Credits: 400
Included SMS Credits: 600
Best For: Large receptions, festivals
Stripe Metadata:
  type: event_pass
  credits: 400
  sms_credits: 600
  duration_hours: 72
  prompts_limit: 0
  display_order: 3
```

#### Platinum Event - $900
```yaml
Price: $900.00 (90,000 cents)
Events Allowed: 1
Event Window: 96 hours
Prompt Limit: Unlimited (0)
Included Image Credits: 750
Included SMS Credits: 1,200
Best For: Enterprise, brand activations
Stripe Metadata:
  type: event_pass
  credits: 750
  sms_credits: 1200
  duration_hours: 96
  prompts_limit: 0
  display_order: 4
```

---

## 📅 3. MONTHLY/ANNUAL SUBSCRIPTIONS (Recurring Users)

**Purpose:** Regular credit allocation for ongoing users

**Key Rules:**
- Credits reset each billing period (no rollover)
- Do not grant event access by themselves
- Prompt limits enforced per event
- Must purchase Event Pass to host events

### Free Tier
```yaml
Name: Free
Price: $0.00 (0 cents)
Billing Period: Monthly
Image Credits: 10 per month
SMS Credits: 0 per month
Max Events: 1 concurrent
Prompts Per Event: 3
Features: Basic access
Stripe Metadata: Not in Stripe (free tier)
```

### Starter Tier

#### Starter Monthly - $29/month
```yaml
Price: $29.00 (2,900 cents)
Billing Period: Monthly
Image Credits: 60 per month
SMS Credits: 50 per month
Max Events: 1 concurrent
Prompts Per Event: 3
Features: Basic support
Stripe Metadata:
  type: subscription
  tier: starter
  billing_period: monthly
  credits_per_period: 60
  sms_credits_per_period: 50
  prompts_limit: 3
  concurrent_events: 1
  display_order: 10
```

#### Starter Annual - $299/year
```yaml
Price: $299.00 (29,900 cents)
Billing Period: Annual
Image Credits: 720 per year (~60/month)
SMS Credits: 600 per year (~50/month)
Max Events: 1 concurrent
Prompts Per Event: 3
Features: Basic support, save with annual billing
Stripe Metadata:
  type: subscription
  tier: starter
  billing_period: annual
  credits_per_period: 720
  sms_credits_per_period: 600
  prompts_limit: 3
  concurrent_events: 1
  display_order: 10
```

### Pro Tier

#### Pro Monthly - $79/month
```yaml
Price: $79.00 (7,900 cents)
Billing Period: Monthly
Image Credits: 200 per month
SMS Credits: 150 per month
Max Events: 1 concurrent
Prompts Per Event: 6
Features: Priority support
Stripe Metadata:
  type: subscription
  tier: pro
  billing_period: monthly
  credits_per_period: 200
  sms_credits_per_period: 150
  prompts_limit: 6
  concurrent_events: 1
  display_order: 20
```

#### Pro Annual - $799/year
```yaml
Price: $799.00 (79,900 cents)
Billing Period: Annual
Image Credits: 2,400 per year (~200/month)
SMS Credits: 1,800 per year (~150/month)
Max Events: 1 concurrent
Prompts Per Event: 6
Features: Priority support, save with annual billing
Stripe Metadata:
  type: subscription
  tier: pro
  billing_period: annual
  credits_per_period: 2400
  sms_credits_per_period: 1800
  prompts_limit: 6
  concurrent_events: 1
  display_order: 20
```

### Premium Tier

#### Premium Monthly - $149/month
```yaml
Price: $149.00 (14,900 cents)
Billing Period: Monthly
Image Credits: 450 per month
SMS Credits: 300 per month
Max Events: 1 concurrent
Prompts Per Event: 9
Features: Priority support, advanced features
Stripe Metadata:
  type: subscription
  tier: premium
  billing_period: monthly
  credits_per_period: 450
  sms_credits_per_period: 300
  prompts_limit: 9
  concurrent_events: 1
  display_order: 30
```

#### Premium Annual - $1,499/year
```yaml
Price: $1,499.00 (149,900 cents)
Billing Period: Annual
Image Credits: 5,400 per year (~450/month)
SMS Credits: 3,600 per year (~300/month)
Max Events: 1 concurrent
Prompts Per Event: 9
Features: Priority support, advanced features, save with annual billing
Stripe Metadata:
  type: subscription
  tier: premium
  billing_period: annual
  credits_per_period: 5400
  sms_credits_per_period: 3600
  prompts_limit: 9
  concurrent_events: 1
  display_order: 30
```

### Platinum Tier

#### Platinum Monthly - $299/month
```yaml
Price: $299.00 (29,900 cents)
Billing Period: Monthly
Image Credits: 1,000 per month
SMS Credits: 750 per month
Max Events: 1 concurrent
Prompts Per Event: 12
Features: Dedicated support, all features
Stripe Metadata:
  type: subscription
  tier: platinum
  billing_period: monthly
  credits_per_period: 1000
  sms_credits_per_period: 750
  prompts_limit: 12
  concurrent_events: 1
  display_order: 40
```

#### Platinum Annual - $2,999/year
```yaml
Price: $2,999.00 (299,900 cents)
Billing Period: Annual
Image Credits: 12,000 per year (~1,000/month)
SMS Credits: 9,000 per year (~750/month)
Max Events: 1 concurrent
Prompts Per Event: 12
Features: Dedicated support, all features, save with annual billing
Stripe Metadata:
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

## 🏢 4. ACTIVATION PLANS (Large Ongoing Activations)

**Purpose:** Always-on or recurring brand activations with high volume

**Key Rules:**
- Include event access (always-on or time-limited)
- Monthly credit allocation
- Multiple concurrent events supported
- Enterprise-level features

### Products

#### Activation 2.5K - $699/month
```yaml
Price: $699.00 (69,900 cents)
Billing Period: Monthly
Image Credits: 2,500 per month
SMS Credits: 2,000 per month
Max Events: 5 concurrent
Event Duration: Always-on (no time limit)
Prompts Per Event: Unlimited (0)
Features:
  - Deterministic seeds: ✅
  - Priority queue: ✅
  - Brand controls: ❌
  - Team accounts: ❌
Stripe Metadata:
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

#### Activation 5K - $1,299/month
```yaml
Price: $1,299.00 (129,900 cents)
Billing Period: Monthly
Image Credits: 5,000 per month
SMS Credits: 4,000 per month
Max Events: Unlimited (999)
Event Duration: Always-on (no time limit)
Prompts Per Event: Unlimited (0)
Features:
  - Deterministic seeds: ✅
  - Priority queue: ✅ (Highest)
  - Brand controls: ✅
  - Team accounts: ✅
  - Dedicated support: ✅
Stripe Metadata:
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

## 📊 CREDIT CONSUMPTION PRIORITY

When a user generates an image or sends an SMS, credits are consumed in this order:

### For Image Generation:
1. **Subscription Credits** (from active monthly/annual plan) - consumed first
2. **Purchased Credits** (from Credit Top-Ups) - consumed second
3. **Event Credits** (included with Event Pass) - consumed last

### For SMS Delivery:
1. **Subscription SMS Credits** (from active monthly/annual plan) - consumed first
2. **Purchased SMS Credits** (from Credit Top-Ups) - consumed second
3. **Event SMS Credits** (included with Event Pass) - consumed last

**Rationale:** Subscription credits reset monthly, so use them first. Purchased credits never expire, so save them. Event credits are starter buffers.

---

## 🔒 ENFORCEMENT RULES

### Event Creation Rules
```javascript
// User can create event if:
(hasActiveEventPass() || hasActiveActivationPlan()) &&
!exceededConcurrentEventLimit()
```

### Credit Consumption Rules
```javascript
// User can generate image if:
getTotalImageCredits() > 0

// User can send SMS if:
getTotalSMSCredits() > 0
```

### Prompt Limit Rules
```javascript
// Max prompts per event based on:
- Event Pass: Use event_pass.prompts_limit (0 = unlimited)
- Subscription: Use subscription_tier.prompts_limit
- Activation: Always unlimited (prompts_limit = 0)
```

---

## 🎯 BUSINESS LOGIC REQUIREMENTS

### Database Functions Required

#### `get_total_image_credits(user_id)`
Returns: `subscription_credits + purchased_credits + event_credits`

#### `get_total_sms_credits(user_id)`
Returns: `subscription_sms_credits + purchased_sms_credits + event_sms_credits`

#### `consume_image_credit(user_id, amount)`
Consumes credits in priority order (subscription → purchased → event)

#### `consume_sms_credit(user_id, amount)`
Consumes SMS credits in priority order (subscription → purchased → event)

#### `has_event_access(user_id)`
Returns: true if user has active event pass or activation plan

#### `get_prompt_limit(user_id, event_id)`
Returns: prompt limit based on event pass or subscription tier

---

## 📝 UI/UX REQUIREMENTS

### Pricing Page Requirements

**Must Display:**
1. Four sections: Credit Top-Ups, Event Passes, Subscriptions, Activations
2. Clear differentiation between credit fuel vs event access
3. Feature comparison tables
4. "What You Get" explanations
5. Call-to-action buttons with Stripe checkout

**Must Avoid:**
- Mixing credit top-ups with event passes
- Suggesting event passes are cheap credit packs
- Implying subscriptions grant event access
- Any "unlimited" language (except where true)

### Credit Display Requirements

**Dashboard Must Show:**
```
Image Credits: [subscription] + [purchased] + [event] = [total]
SMS Credits: [subscription] + [purchased] + [event] = [total]
```

**Tooltips:**
- Subscription: "Resets monthly/annually"
- Purchased: "Never expires"
- Event: "Included with event pass"

---

## ✅ VALIDATION CHECKLIST

Before deploying pricing changes:

- [ ] All prices match Stripe dashboard exactly
- [ ] Database has all required columns
- [ ] Credit consumption priority enforced
- [ ] Event access checks implemented
- [ ] Prompt limits enforced per plan
- [ ] UI shows all four pricing categories
- [ ] Tooltips explain credit types
- [ ] Event creation blocked without access
- [ ] Admin dashboard reflects true balances
- [ ] No legacy pricing visible anywhere
- [ ] Marketing copy updated
- [ ] Help documentation updated

---

## 📞 SUPPORT SCENARIOS

### Customer: "Why do I need both credits and an event pass?"

**Answer:** "Credits are like fuel - they power your AI image generation and SMS delivery. Event Passes grant you permission and controls to host an event. Think of it like: you need both a driver's license (Event Pass) and gas (Credits) to drive a car."

### Customer: "Do my credits expire?"

**Answer:** "It depends on the type:
- **Purchased credits** (from Credit Top-Ups) never expire
- **Subscription credits** reset each billing cycle
- **Event credits** (included with Event Pass) remain usable after the event ends"

### Customer: "Can I host multiple events?"

**Answer:** "You need the right plan:
- **Event Passes** grant access to 1 event each
- **Activation 2.5K** allows up to 5 concurrent events
- **Activation 5K** allows unlimited concurrent events"

### Customer: "What's the difference between Event Pass and Activation Plan?"

**Answer:** "Event Passes are for one-time events (weddings, parties, single activations) with a defined time window. Activation Plans are for always-on or recurring brand activations that run continuously with high volume."

---

## 📋 COMPLETE PRODUCT SUMMARY

### Total Products: 19
- **1** Free Tier (no Stripe product)
- **8** Standard Subscriptions (4 monthly + 4 annual)
- **2** Activation Plans
- **4** Event Passes
- **4** Credit Top-ups

### Tier Display Order
1. Free (display_order: 1)
2. Starter (display_order: 10)
3. Pro (display_order: 20)
4. Premium (display_order: 30)
5. Platinum (display_order: 40)
6. Activation 2.5K (display_order: 100)
7. Activation 5K (display_order: 101)
8. Enterprise (display_order: 999) - Contact Us

---

**Document Version:** 2.0
**Authority Level:** CANONICAL - All application code must reference this
**Next Review:** Before any pricing change
