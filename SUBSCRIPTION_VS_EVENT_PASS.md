# Subscription vs Event Pass System

## Overview

The system now has clear distinctions between subscription-based accounts and event pass accounts, with different event duration rules for each.

---

## Business Rules

### 1. Active Monthly/Yearly Subscription Accounts

**Event Duration:** UNLIMITED ✅

- Events run continuously without time restrictions
- No start/end datetime required
- Can optionally set start/end times for event management
- Events will NOT automatically deactivate
- Users do NOT need event passes
- Cannot use event passes (they're not needed)

**Eligible Subscription Tiers:**
- Monthly subscription plans
- Yearly subscription plans
- Any tier with `subscription_status = 'active'` (excluding Free tier and Event Pass-only)

**UI Behavior:**
- EventPassSelector shows green success message: "Active Subscription - Unlimited Event Duration"
- Start/End datetime fields are optional
- Clear messaging: "Your events will run continuously without time restrictions"

---

### 2. Event Pass Accounts

**Event Duration:** TIME-LIMITED ⏱️

- Events MUST have start and end datetime
- Events automatically deactivate when pass expires
- Duration calculated as: activated_at + pass_duration_hours
- Pass is consumed when event is created
- Cannot create unlimited duration events

**How Event Passes Work:**
1. User purchases event pass (separate from subscription)
2. User selects pass when creating event
3. Pass is activated when event is created
4. Event automatically deactivates when pass expires
5. Pass cannot be reused

**UI Behavior:**
- EventPassSelector shows available passes to select
- Expiration time calculated and displayed
- Start/End datetime fields are REQUIRED
- Warning: "This pass will be activated when you create the event and cannot be reused"

---

### 3. Free Tier / No Access

**Event Duration:** NO ACCESS ❌

- Cannot create events
- Must purchase event pass or subscribe

**UI Behavior:**
- EventPassSelector shows yellow warning: "Event Pass Required"
- Instructions to purchase event pass or subscribe
- Cannot proceed without access

---

## Database Functions

### 1. `has_active_subscription(p_user_id uuid)`

Returns `boolean` - whether user has active monthly/yearly subscription.

```sql
SELECT has_active_subscription('user-uuid-here');
-- Returns: true or false
```

### 2. `get_user_subscription_type(p_user_id uuid)`

Returns subscription details:

```sql
SELECT * FROM get_user_subscription_type('user-uuid-here');
-- Returns:
-- subscription_type: 'subscription' | 'event_pass' | 'free'
-- tier_name: Name of subscription tier
-- has_active_sub: boolean
-- has_available_passes: boolean
```

### 3. `validate_event_time_restrictions(p_user_id, p_start_datetime, p_end_datetime, p_pass_id)`

Validates event time restrictions based on user type:

```sql
SELECT * FROM validate_event_time_restrictions(
  'user-uuid',
  '2026-01-20T14:00:00Z',  -- start datetime
  '2026-01-22T14:00:00Z',  -- end datetime
  'pass-uuid'               -- optional pass ID
);
-- Returns:
-- is_valid: boolean
-- error_message: text (if invalid)
-- restriction_type: text (reason/type)
```

**Validation Results:**

| User Type | Pass Selected | Start/End Times | Result | Restriction Type |
|-----------|---------------|----------------|--------|-----------------|
| Subscription | No | Optional | ✅ Valid | subscription_unlimited |
| Subscription | Yes | Any | ❌ Invalid | subscription_no_pass |
| Event Pass | Yes | Required | ✅ Valid | event_pass_valid |
| Event Pass | Yes | Missing | ❌ Invalid | pass_requires_times |
| No Access | No | Any | ❌ Invalid | pass_or_subscription_required |
| Event Pass | Invalid Pass | Any | ❌ Invalid | invalid_pass |

---

## Backend Functions

### TypeScript/React

```typescript
import {
  getUserSubscriptionType,
  validateEventTimeRestrictions,
  hasActiveSubscription
} from '../services/backendService';

// Check user subscription type
const subType = await getUserSubscriptionType();
console.log(subType);
// {
//   subscriptionType: 'subscription',
//   tierName: 'Professional Monthly',
//   hasActiveSub: true,
//   hasAvailablePasses: false
// }

// Validate event restrictions before creating event
const validation = await validateEventTimeRestrictions(
  startDatetime,  // ISO string or undefined
  endDatetime,    // ISO string or undefined
  passId          // UUID or undefined
);

if (!validation.isValid) {
  alert(validation.errorMessage);
  return;
}

// Quick check for active subscription
const isSubscriber = await hasActiveSubscription();
// Returns: boolean
```

---

## UI Components

### EventPassSelector Component

Shows different UI based on user type:

#### For Active Subscription Users:
```tsx
<EventPassSelector
  timezone={userTimezone}
  selectedPassId={undefined}
  startDatetime={event.startDatetime}
  onSelectPass={(passId, expiresAt) => {
    // Won't be called - component shows "Active Subscription" message
  }}
/>
```

**Displays:**
- ✅ Green success box
- "Active Subscription" heading
- Tier name display
- "Unlimited Event Duration" message
- Clear text: "Your events will run continuously without time restrictions"

#### For Event Pass Users:
```tsx
<EventPassSelector
  timezone={userTimezone}
  selectedPassId={event.passId}
  startDatetime={event.startDatetime}
  onSelectPass={(passId, expiresAt) => {
    setEvent({
      ...event,
      passId,
      passExpiresAt: expiresAt,
      endDatetime: expiresAt  // Auto-set end time to pass expiration
    });
  }}
/>
```

**Displays:**
- 🎫 Blue box with pass selection
- List of available passes
- Duration and purchase date for each pass
- Calculated expiration time
- Warning about pass activation

#### For Free/No Access Users:
**Displays:**
- ⚠️ Yellow warning box
- "Event Pass Required" heading
- Instructions to purchase pass or subscribe

---

## SmugMug Gallery Management

**Admin-Only Feature** 🔒

The SmugMugGallerySync component is now restricted to administrators only.

### Usage:

```tsx
import { SmugMugGallerySync } from './SmugMugGallerySync';
import { getUserProfile } from '../services/backendService';

const profile = await getUserProfile();
const isAdmin = profile.role === 'admin';

<SmugMugGallerySync
  eventId={event.id}
  eventName={event.name}
  currentGalleryKey={event.smugmugGalleryKey}
  currentGalleryUrl={event.smugmugGalleryUrl}
  isAdmin={isAdmin}  // REQUIRED - must be true to show functionality
  onSync={async (key, url) => {
    await syncSmugMugGallery(event.id, key, url);
  }}
  onCreateNew={async () => {
    return await createSmugMugGalleryForEvent(event.id, event.name, event.city);
  }}
/>
```

**Non-Admin Users:**
- Component shows gray disabled state
- Message: "SmugMug gallery management is only available to administrators"
- No gallery creation or sync functionality accessible

**Admin Users:**
- Full gallery management functionality
- Can create new galleries
- Can manually sync existing galleries
- Can view and open galleries

---

## Event Creation Flow

### For Subscription Users:

```typescript
const handleCreateEvent = async (event: Event) => {
  // 1. Check user type
  const subType = await getUserSubscriptionType();

  if (subType.hasActiveSub) {
    // 2. Subscription users - unlimited duration
    // Start/End times are optional
    const eventData = {
      ...event,
      // Times can be null/undefined
      startDatetime: event.startDatetime || null,
      endDatetime: event.endDatetime || null,
      passId: undefined,  // No pass needed
    };

    // 3. Create event
    await saveEvent(eventData);

    alert('Event created successfully! This event will run continuously.');
  }
};
```

### For Event Pass Users:

```typescript
const handleCreateEvent = async (event: Event) => {
  // 1. Validate event restrictions
  const validation = await validateEventTimeRestrictions(
    event.startDatetime,
    event.endDatetime,
    event.passId
  );

  if (!validation.isValid) {
    alert(validation.errorMessage);
    return;
  }

  // 2. Create event
  const savedEvent = await saveEvent(event);

  // 3. Activate pass
  if (event.passId) {
    await activateEventPass(event.passId, savedEvent.id);
  }

  alert(`Event created! Pass expires: ${formatDateTime(event.passExpiresAt)}`);
};
```

---

## Error Messages

### User-Friendly Error Messages:

| Scenario | Error Message |
|----------|--------------|
| Subscription user tries to use pass | "You have an active subscription. Event passes are not needed for subscription accounts." |
| Event pass without times | "Event pass events must have start and end times specified." |
| Invalid pass selected | "Selected event pass is invalid or already activated." |
| End before start | "Event end time must be after start time." |
| No access at all | "You need an active subscription or event pass to create events. Please purchase a plan." |
| Has passes but none selected | "Please select an event pass to create this event, or subscribe to a monthly/yearly plan for unlimited events." |

---

## Database Schema

### Relevant Tables:

#### user_profiles
```sql
- subscription_status: text  -- 'active', 'inactive', 'canceled'
- subscription_tier_id: uuid
```

#### subscription_tiers
```sql
- name: text  -- e.g., 'Professional Monthly', 'Enterprise Yearly'
- event_pass_duration_hours: integer (nullable)
```

#### user_event_passes
```sql
- user_id: uuid
- tier_id: uuid
- purchased_at: timestamptz
- activated_at: timestamptz (nullable)  -- NULL means unused
- event_id: uuid (nullable)  -- Links to event when activated
```

#### events
```sql
- created_by: uuid
- start_datetime: timestamptz (nullable)
- end_datetime: timestamptz (nullable)
```

---

## Testing Checklist

### Subscription Users:
- [ ] Can create events without time restrictions
- [ ] Start/End times are optional
- [ ] EventPassSelector shows "Active Subscription" message
- [ ] Cannot select event passes
- [ ] Events do not auto-deactivate

### Event Pass Users:
- [ ] Must select an event pass
- [ ] Start/End times are required
- [ ] Pass expiration calculated correctly
- [ ] Pass activated when event created
- [ ] Event auto-deactivates when pass expires
- [ ] Pass cannot be reused

### Free Tier Users:
- [ ] Cannot create events
- [ ] EventPassSelector shows warning
- [ ] Clear instructions to upgrade

### Admin Users:
- [ ] Can access SmugMug gallery management
- [ ] Can create galleries
- [ ] Can manually sync galleries

### Regular Users:
- [ ] Cannot access SmugMug gallery management
- [ ] See disabled state message

---

## Migration Path

### Existing Events

All existing events have been backfilled:
- `created_by` field set to `user_id`
- RLS policies updated to check both `created_by` OR `user_id`
- No data loss or breaking changes

### Existing Users

- Subscription users can continue creating unlimited events
- Event pass behavior is new - no existing event passes affected
- Free tier users must upgrade to create events

---

## Summary

| Account Type | Event Duration | Start/End Required | Pass Needed | SmugMug Gallery |
|--------------|---------------|-------------------|-------------|-----------------|
| **Active Subscription** | ♾️ Unlimited | ❌ Optional | ❌ No | 🔒 Admin Only |
| **Event Pass** | ⏱️ Time-Limited | ✅ Required | ✅ Yes | 🔒 Admin Only |
| **Free Tier** | ❌ No Access | N/A | ✅ Must Upgrade | 🔒 Admin Only |

---

## Key Takeaways

1. **Subscription = Unlimited** - Active monthly/yearly subscribers get unlimited event duration
2. **Event Pass = Time-Limited** - Event pass users must have start/end times
3. **No Mixing** - Subscription users don't use event passes
4. **Database Enforced** - Validation happens at database level for security
5. **Clear UI** - Different messages for each user type
6. **SmugMug Admin-Only** - Gallery management restricted to administrators
7. **Backward Compatible** - Existing events continue to work

---

## Support

For questions or issues:
1. Check `SUBSCRIPTION_VS_EVENT_PASS.md` (this file)
2. Review database functions in migration files
3. Test with different account types
4. Check error messages in validation function
