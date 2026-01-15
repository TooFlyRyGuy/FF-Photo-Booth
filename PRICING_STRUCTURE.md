# Canonical Pricing Structure

**Last Updated:** January 15, 2026
**Status:** AUTHORITATIVE - This is the source of truth for all pricing

---

## 🔴 CRITICAL PRINCIPLES

### 1. **Stripe is the Source of Truth**
All prices must match Stripe product configuration exactly.

### 2. **Three Distinct Systems - DO NOT MERGE**

#### Image Credits → Fuel (Never Expire)
- Used to generate AI images
- Purchased through Credit Top-Ups
- Included as starter buffers in Event Passes
- Allocated monthly/annually via Subscriptions and Activations

#### SMS Credits → Delivery (Never Expire)
- Used to send photos via text message
- Purchased through Credit Top-Ups
- Included as starter buffers in Event Passes
- Allocated monthly/annually via Subscriptions and Activations

#### Event Access → Time-Bound Permissions
- Required to create and activate events
- Purchased through Event Passes
- Included in Activation Plans (always-on)
- **Credit Top-Ups DO NOT grant event access**
- **Event Passes DO NOT exist to provide cheap credits**

---

## 💳 1. CREDIT TOP-UPS (Permanent Fuel)

**Purpose:** Provide non-expiring credits for image generation and SMS delivery

**Key Rules:**
- Credits never expire
- Can be used across any event (if event access exists)
- Stack cumulatively
- Do not grant event creation rights

### Products

#### Small Boost - $49
```yaml
Price: $49.00 ($4,900 cents)
Image Credits: 120
SMS Credits: 120
Expiration: Never
Use Case: Small events, trial customers
```

#### Creator Pack - $129
```yaml
Price: $129.00 ($12,900 cents)
Image Credits: 350
SMS Credits: 350
Expiration: Never
Use Case: Medium events, regular users
```

#### Pro Boost - $279
```yaml
Price: $279.00 ($27,900 cents)
Image Credits: 900
SMS Credits: 900
Expiration: Never
Use Case: Large events, power users
```

#### Power Pack - $499
```yaml
Price: $499.00 ($49,900 cents)
Image Credits: 1,800
SMS Credits: 1,800
Expiration: Never
Use Case: Multiple events, agencies
```

### UI Copy Templates

**Heading:** "Credit Top-Ups - Fuel That Never Expires"

**Subheading:** "Purchase credits to power your events. Credits never expire and can be used across all your events."

**Important Note:** "Top-ups provide credits only. You need an Event Pass or Activation Plan to create events."

---

## 🎟️ 2. EVENT PASSES (Time-Bound Access)

**Purpose:** Grant permission to create and host events with time-limited access

**Key Rules:**
- Required to create or activate events
- Expire at end of event window
- Include starter credits as buffers (not the primary value)
- Can use additional Credit Top-Up credits during event

### Products

#### Starter Event - $150
```yaml
Price: $150.00 ($15,000 cents)
Events Allowed: 1
Event Window: 24 hours
Prompt Limit: 3 prompts per event
Included Image Credits: 100
Included SMS Credits: 150
Features:
  - 1 event allowed
  - 24-hour event window
  - 3 prompt limit
  - 100 image credits included
  - 150 SMS credits included
  - Standard generation queue
Advanced Features:
  - Deterministic Seeds: ❌
  - Priority Queue: ❌
  - Prompt Locking: ❌
  - Admin Controls: ❌
  - Brand Locking: ❌
```

#### Pro Event - $280
```yaml
Price: $280.00 ($28,000 cents)
Events Allowed: 1
Event Window: 48 hours
Prompt Limit: 6 prompts per event
Included Image Credits: 200
Included SMS Credits: 300
Features:
  - 1 event allowed
  - 48-hour event window
  - 6 prompt limit
  - 200 image credits included
  - 300 SMS credits included
  - Priority generation queue
Advanced Features:
  - Deterministic Seeds: ❌
  - Priority Queue: ✅
  - Prompt Locking: ❌
  - Admin Controls: ❌
  - Brand Locking: ❌
```

#### Premium Event - $520
```yaml
Price: $520.00 ($52,000 cents)
Events Allowed: 1
Event Window: 72 hours
Prompt Limit: Unlimited
Included Image Credits: 400
Included SMS Credits: 600
Features:
  - 1 event allowed
  - 72-hour event window
  - Unlimited prompts
  - 400 image credits included
  - 600 SMS credits included
  - Deterministic seeds
  - Prompt locking
  - Priority generation queue
Advanced Features:
  - Deterministic Seeds: ✅
  - Priority Queue: ✅
  - Prompt Locking: ✅
  - Admin Controls: ❌
  - Brand Locking: ❌
```

#### Platinum Event - $900
```yaml
Price: $900.00 ($90,000 cents)
Events Allowed: 1
Event Window: 96 hours
Prompt Limit: Unlimited
Included Image Credits: 750
Included SMS Credits: 1,200
Features:
  - 1 event allowed
  - 96-hour event window
  - Unlimited prompts
  - 750 image credits included
  - 1,200 SMS credits included
  - Deterministic seeds
  - Advanced admin controls
  - Brand locking
  - Highest priority queue
Advanced Features:
  - Deterministic Seeds: ✅
  - Priority Queue: ✅ (Highest)
  - Prompt Locking: ✅
  - Admin Controls: ✅
  - Brand Locking: ✅
```

### UI Copy Templates

**Heading:** "Event Passes - Host Your Event"

**Subheading:** "Purchase an event pass to create and host your event. Each pass includes starter credits and advanced features."

**Important Note:** "Event passes grant event access and controls. Purchase Credit Top-Ups if you need more generation fuel."

---

## 📅 3. MONTHLY/ANNUAL SUBSCRIPTIONS (Recurring Users)

**Purpose:** Regular credit allocation for ongoing users

**Key Rules:**
- Credits reset each billing period
- Do not grant event access by themselves
- Prompt limits enforced per event
- Must purchase Event Pass to host events

### Subscription Tiers & Prompt Limits

All subscriptions exist in both Monthly and Annual variants:

#### Starter Tier
```yaml
Prompt Limit: 3 prompts per event
Monthly Variant: (Existing Stripe pricing)
Annual Variant: (Existing Stripe pricing)
```

#### Pro Tier
```yaml
Prompt Limit: 6 prompts per event
Monthly Variant: (Existing Stripe pricing)
Annual Variant: (Existing Stripe pricing)
```

#### Premium Tier
```yaml
Prompt Limit: 9 prompts per event
Monthly Variant: (Existing Stripe pricing)
Annual Variant: (Existing Stripe pricing)
```

#### Platinum Tier
```yaml
Prompt Limit: 12 prompts per event
Monthly Variant: (Existing Stripe pricing)
Annual Variant: (Existing Stripe pricing)
```

### UI Copy Templates

**Heading:** "Monthly & Annual Plans"

**Subheading:** "Get regular credit allocations for ongoing use. Subscriptions provide credits but you'll need an Event Pass to host events."

**Important Note:** "Subscriptions give you monthly/annual credits. To create events, purchase an Event Pass."

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
Price: $699.00/month ($69,900 cents)
Image Credits: 2,500 per month
SMS Credits: 2,000 per month
Concurrent Events: Up to 5
Event Duration: Always-on (no time limit)
Prompt Limit: Unlimited
Features:
  - 2,500 image credits per month
  - 2,000 SMS credits per month
  - Up to 5 concurrent events
  - Always-on event duration
  - Unlimited prompts
  - Deterministic seeds
  - Priority generation queue
  - Admin dashboard
Advanced Features:
  - Deterministic Seeds: ✅
  - Priority Queue: ✅
  - Brand Controls: ❌
  - Team Accounts: ❌
  - Prompt Governance: ❌
```

#### Activation 5K - $1,299/month
```yaml
Price: $1,299.00/month ($129,900 cents)
Image Credits: 5,000 per month
SMS Credits: 4,000 per month
Concurrent Events: Unlimited
Event Duration: Always-on (no time limit)
Prompt Limit: Unlimited
Features:
  - 5,000 image credits per month
  - 4,000 SMS credits per month
  - Unlimited concurrent events
  - Always-on event duration
  - Unlimited prompts
  - Deterministic seeds
  - Brand controls & governance
  - Team accounts
  - Highest priority queue
  - Dedicated support
Advanced Features:
  - Deterministic Seeds: ✅
  - Priority Queue: ✅ (Highest)
  - Brand Controls: ✅
  - Team Accounts: ✅
  - Prompt Governance: ✅
```

### UI Copy Templates

**Heading:** "Activation Plans - Enterprise Solutions"

**Subheading:** "Always-on access for recurring brand activations. High volume credits, unlimited events, and enterprise controls."

**Important Note:** "Activation plans include event access, high-volume credits, and team features. Perfect for agencies and ongoing campaigns."

---

## 🎨 5. ADD-ONS (Optional Services)

### Branded Photo Gallery - $49
```yaml
Price: $49.00 ($4,900 cents)
Description: Professional branded photo gallery with custom branding, domain, and premium features
Delivery: Email
Type: One-time service
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

**Rationale:** Subscription credits reset monthly, so use them first. Purchased credits never expire, so save them. Event credits are starter buffers and expire with the event.

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

### Event Creation Screen Requirements

**Before Creating Event:**
- Check if user has event access
- If no access, show modal:
  - "Event Pass Required"
  - Explain what event passes provide
  - Link to purchase event pass
  - Show activation plans as alternative

### Credit Display Requirements

**Dashboard Must Show:**
```
Image Credits: [subscription] + [purchased] + [event] = [total]
SMS Credits: [subscription] + [purchased] + [event] = [total]
```

**Tooltips:**
- Subscription: "Resets monthly/annually"
- Purchased: "Never expires"
- Event: "Expires with event pass"

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

## 🚫 DEPRECATED CONCEPTS (DO NOT USE)

### ❌ Old Event Pass Model
- Event passes as cheap credit packs
- Unlimited usage language
- Confusing credit + access bundling

### ❌ Old Subscription Model
- Subscriptions granting event access
- Unclear prompt limits
- "Pay for credits, get events free" model

### ❌ Legacy Pricing
- Any prices not listed in this document
- Three-tier event pass system
- Mixed credit + event pricing

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

**Document Version:** 1.0
**Authority Level:** CANONICAL - All application code must reference this
**Next Review:** Before any pricing change
