# Integration Guide: Subscription vs Event Pass System

## Quick Reference

**IMPORTANT RULES:**
1. ✅ **Subscription users** = Unlimited event duration (no time restrictions)
2. ⏱️ **Event pass users** = Time-limited events (must have start/end times)
3. 🔒 **SmugMug gallery management** = Admin only

---

## Step 1: Update Event Creation Form

Add subscription checking to your event form:

```tsx
import { EventPassSelector } from './EventPassSelector';
import {
  getUserSubscriptionType,
  validateEventTimeRestrictions,
  getUserProfile
} from '../services/backendService';

function EventCreationForm() {
  const [event, setEvent] = useState<Event>({...});
  const [userTimezone, setUserTimezone] = useState('UTC');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<UserSubscriptionType | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const profile = await getUserProfile();
    setUserProfile(profile);
    setUserTimezone(profile.timezone || 'UTC');

    const subType = await getUserSubscriptionType();
    setSubscriptionType(subType);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate event restrictions
    const validation = await validateEventTimeRestrictions(
      event.startDatetime,
      event.endDatetime,
      event.passId
    );

    if (!validation.isValid) {
      alert(validation.errorMessage);
      return;
    }

    // Create event
    try {
      const savedEvent = await saveEvent(event);

      // Activate pass if selected
      if (event.passId) {
        await activateEventPass(event.passId, savedEvent.id);
      }

      alert('Event created successfully!');
      onEventCreated(savedEvent);
    } catch (error: any) {
      alert(`Failed to create event: ${error.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Event Name, City, etc. */}
      <input
        type="text"
        value={event.name}
        onChange={(e) => setEvent({ ...event, name: e.target.value })}
        required
      />

      {/* Event Pass Selector */}
      <EventPassSelector
        timezone={userTimezone}
        selectedPassId={event.passId}
        startDatetime={event.startDatetime}
        onSelectPass={(passId, expiresAt) => {
          setEvent({
            ...event,
            passId,
            passExpiresAt: expiresAt,
            // Auto-set end time to pass expiration for event pass users
            endDatetime: expiresAt,
          });
        }}
      />

      {/* Conditional: Show datetime pickers only if needed */}
      {!subscriptionType?.hasActiveSub && (
        <>
          <TimezoneDateTimePicker
            label="Event Start"
            value={event.startDatetime}
            timezone={userTimezone}
            onChange={(isoString) => setEvent({ ...event, startDatetime: isoString })}
            required
          />

          <TimezoneDateTimePicker
            label="Event End"
            value={event.endDatetime}
            timezone={userTimezone}
            onChange={(isoString) => setEvent({ ...event, endDatetime: isoString })}
            minDate={event.startDatetime}
            required
          />
        </>
      )}

      {/* Optional: Show datetime pickers for subscription users */}
      {subscriptionType?.hasActiveSub && (
        <>
          <p className="text-sm text-green-700 mb-2">
            As a subscription user, start and end times are optional. Leave blank for unlimited duration.
          </p>

          <TimezoneDateTimePicker
            label="Event Start (Optional)"
            value={event.startDatetime}
            timezone={userTimezone}
            onChange={(isoString) => setEvent({ ...event, startDatetime: isoString })}
            required={false}
          />

          <TimezoneDateTimePicker
            label="Event End (Optional)"
            value={event.endDatetime}
            timezone={userTimezone}
            onChange={(isoString) => setEvent({ ...event, endDatetime: isoString })}
            minDate={event.startDatetime}
            required={false}
          />
        </>
      )}

      <button type="submit">Create Event</button>
    </form>
  );
}
```

---

## Step 2: Add SmugMug Gallery Management (Admin Only)

In your **admin event editing view** (e.g., AdminDashboard.tsx):

```tsx
import { SmugMugGallerySync } from './SmugMugGallerySync';
import {
  syncSmugMugGallery,
  createSmugMugGalleryForEvent,
  getUserProfile
} from '../services/backendService';

function AdminEventEditor({ event }: { event: Event }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const profile = await getUserProfile();
    setUserProfile(profile);
  };

  const isAdmin = userProfile?.role === 'admin';

  return (
    <div>
      {/* Event editing form fields */}

      {/* SmugMug Gallery Management - ADMIN ONLY */}
      <SmugMugGallerySync
        eventId={event.id}
        eventName={event.name}
        currentGalleryKey={event.smugmugGalleryKey}
        currentGalleryUrl={event.smugmugGalleryUrl}
        isAdmin={isAdmin}
        onSync={async (galleryKey, galleryUrl) => {
          await syncSmugMugGallery(event.id, galleryKey, galleryUrl);
          await reloadEvent();
        }}
        onCreateNew={async () => {
          const result = await createSmugMugGalleryForEvent(
            event.id,
            event.name,
            event.city
          );
          await reloadEvent();
          return result;
        }}
      />
    </div>
  );
}
```

**IMPORTANT:** Do NOT include SmugMugGallerySync in regular user views. It should only appear in admin-specific event management interfaces.

---

## Step 3: Display Subscription Status

Show user their current subscription type:

```tsx
import { getUserSubscriptionType } from '../services/backendService';

function SubscriptionStatus() {
  const [subType, setSubType] = useState<UserSubscriptionType | null>(null);

  useEffect(() => {
    loadSubscriptionType();
  }, []);

  const loadSubscriptionType = async () => {
    const type = await getUserSubscriptionType();
    setSubType(type);
  };

  if (!subType) return <div>Loading...</div>;

  return (
    <div className="bg-white p-6 rounded-lg border">
      <h3 className="text-lg font-semibold mb-2">Your Plan</h3>

      {subType.hasActiveSub && (
        <div className="bg-green-50 p-4 rounded border border-green-200">
          <p className="text-green-900 font-medium">{subType.tierName}</p>
          <p className="text-green-700 text-sm mt-1">
            ✅ Unlimited event duration
          </p>
        </div>
      )}

      {!subType.hasActiveSub && subType.hasAvailablePasses && (
        <div className="bg-blue-50 p-4 rounded border border-blue-200">
          <p className="text-blue-900 font-medium">Event Pass Account</p>
          <p className="text-blue-700 text-sm mt-1">
            ⏱️ Time-limited events with event passes
          </p>
        </div>
      )}

      {!subType.hasActiveSub && !subType.hasAvailablePasses && (
        <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
          <p className="text-yellow-900 font-medium">Free Tier</p>
          <p className="text-yellow-700 text-sm mt-1">
            Please purchase an event pass or subscribe to create events
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## Step 4: Update Event Display

Show appropriate information based on event type:

```tsx
import { formatDateTimeInTimezone, getTimeRemaining } from '../services/timezoneService';

function EventCard({ event, timezone }: { event: Event; timezone: string }) {
  const [timeRemaining, setTimeRemaining] = useState<any>(null);

  useEffect(() => {
    if (!event.passExpiresAt) return;

    const updateTimer = () => {
      const remaining = getTimeRemaining(event.passExpiresAt!);
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [event.passExpiresAt]);

  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold">{event.name}</h3>
      <p className="text-gray-600">{event.city}</p>

      {/* Event Pass Information */}
      {event.passExpiresAt && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm font-medium text-blue-900">Event Pass Active</p>
          <p className="text-sm text-blue-700">
            Expires: {formatDateTimeInTimezone(event.passExpiresAt, timezone)}
          </p>
          {timeRemaining && timeRemaining.total > 0 && (
            <p className="text-sm text-blue-700 mt-1">
              Time remaining: {timeRemaining.days}d {timeRemaining.hours}h{' '}
              {timeRemaining.minutes}m
            </p>
          )}
          {timeRemaining && timeRemaining.total <= 0 && (
            <p className="text-sm text-red-700 mt-1 font-medium">
              ⚠️ Pass has expired - Event is now inactive
            </p>
          )}
        </div>
      )}

      {/* Unlimited Duration Information */}
      {!event.passExpiresAt && event.startDatetime && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-sm font-medium text-green-900">Subscription Event</p>
          <p className="text-sm text-green-700">
            Starts: {formatDateTimeInTimezone(event.startDatetime, timezone)}
          </p>
          {event.endDatetime && (
            <p className="text-sm text-green-700">
              Ends: {formatDateTimeInTimezone(event.endDatetime, timezone)}
            </p>
          )}
          {!event.endDatetime && (
            <p className="text-sm text-green-700">
              Duration: Unlimited ♾️
            </p>
          )}
        </div>
      )}

      {/* No time restrictions */}
      {!event.passExpiresAt && !event.startDatetime && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-sm text-green-700">
            ♾️ This event runs continuously without time restrictions
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## Step 5: Validation Before Save

Always validate before saving:

```tsx
import { validateEventTimeRestrictions } from '../services/backendService';

const handleSaveEvent = async (event: Event) => {
  // Validate restrictions
  const validation = await validateEventTimeRestrictions(
    event.startDatetime,
    event.endDatetime,
    event.passId
  );

  if (!validation.isValid) {
    // Show user-friendly error
    alert(validation.errorMessage);
    console.error('Validation failed:', validation.restrictionType);
    return;
  }

  // Proceed with save
  try {
    await saveEvent(event);
    alert('Event saved successfully!');
  } catch (error: any) {
    alert(`Failed to save event: ${error.message}`);
  }
};
```

---

## Step 6: Handle Different User Scenarios

### Scenario A: Subscription User Creates Event

```tsx
// User has active subscription
// UI shows: "Active Subscription - Unlimited Event Duration"
// Start/End times: OPTIONAL
// Pass selection: NOT SHOWN

const event = {
  name: 'Wedding 2026',
  city: 'San Francisco',
  startDatetime: undefined,  // Optional - can be null
  endDatetime: undefined,    // Optional - can be null
  passId: undefined,         // No pass needed
  // ... other fields
};

await saveEvent(event);
// ✅ Event created with unlimited duration
```

### Scenario B: Event Pass User Creates Event

```tsx
// User has event pass(es)
// UI shows: "Select Event Pass" with list of available passes
// Start/End times: REQUIRED
// Pass selection: REQUIRED

const event = {
  name: 'Conference 2026',
  city: 'Austin',
  startDatetime: '2026-03-15T09:00:00Z',  // Required
  endDatetime: '2026-03-17T17:00:00Z',    // Required
  passId: 'pass-uuid-here',                // Required
  passExpiresAt: '2026-03-17T17:00:00Z',  // Auto-calculated
  // ... other fields
};

await saveEvent(event);
await activateEventPass(event.passId!, event.id);
// ✅ Event created with time limit
// ✅ Pass activated and linked to event
```

### Scenario C: Free Tier User Tries to Create Event

```tsx
// User has no subscription and no passes
// UI shows: "Event Pass Required" with upgrade instructions
// Cannot proceed without purchasing pass or subscribing

// Validation will fail:
const validation = await validateEventTimeRestrictions(undefined, undefined, undefined);
// validation.isValid = false
// validation.errorMessage = "You need an active subscription or event pass to create events..."
```

---

## Step 7: Admin-Only Features

### Checking Admin Status

```tsx
import { getUserProfile } from '../services/backendService';

const checkAdminStatus = async () => {
  const profile = await getUserProfile();
  const isAdmin = profile.role === 'admin';
  return isAdmin;
};
```

### Conditionally Showing Admin Features

```tsx
function EventManagement({ event }: { event: Event }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const admin = await checkAdminStatus();
    setIsAdmin(admin);
  };

  return (
    <div>
      {/* Regular event management */}
      <EventEditor event={event} />

      {/* Admin-only features */}
      {isAdmin && (
        <div className="mt-6 border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Admin Tools</h3>

          {/* SmugMug Gallery Management */}
          <SmugMugGallerySync
            eventId={event.id}
            eventName={event.name}
            currentGalleryKey={event.smugmugGalleryKey}
            currentGalleryUrl={event.smugmugGalleryUrl}
            isAdmin={isAdmin}
            onSync={handleSync}
            onCreateNew={handleCreateGallery}
          />
        </div>
      )}
    </div>
  );
}
```

---

## Testing Checklist

### Test as Subscription User:
- [ ] EventPassSelector shows "Active Subscription" message
- [ ] Can create events without start/end times
- [ ] Start/end times are optional
- [ ] Cannot select event passes
- [ ] Events display "Unlimited Duration"
- [ ] SmugMug management not visible (unless admin)

### Test as Event Pass User:
- [ ] EventPassSelector shows available passes
- [ ] Can select a pass
- [ ] Start/end times are required
- [ ] Validation fails without times
- [ ] Pass expiration calculated correctly
- [ ] Event displays time remaining
- [ ] SmugMug management not visible (unless admin)

### Test as Free Tier User:
- [ ] EventPassSelector shows "Event Pass Required"
- [ ] Cannot create events
- [ ] Clear upgrade instructions shown
- [ ] SmugMug management not visible

### Test as Admin:
- [ ] Can access SmugMug gallery management
- [ ] Can create new galleries
- [ ] Can manually sync galleries
- [ ] Non-admin users cannot access these features

---

## Common Issues & Solutions

### Issue: Subscription user sees event pass selector
**Solution:** Check that `getUserSubscriptionType()` is being called and subscription status is correct in database.

### Issue: Event pass user can create unlimited events
**Solution:** Ensure validation is called before saving. Check that `validateEventTimeRestrictions()` is enforced.

### Issue: Regular user can access SmugMug management
**Solution:** Verify `isAdmin` prop is passed correctly and user role is checked.

### Issue: Validation fails with unclear error
**Solution:** Use `validation.restrictionType` to identify specific issue. Check user's subscription status in database.

---

## Database Queries for Debugging

```sql
-- Check user subscription status
SELECT
  up.id,
  up.email,
  up.subscription_status,
  st.name as tier_name,
  has_active_subscription(up.id) as has_active_sub
FROM user_profiles up
LEFT JOIN subscription_tiers st ON up.subscription_tier_id = st.id
WHERE up.email = 'user@example.com';

-- Check available event passes
SELECT
  uep.id,
  st.name as tier_name,
  st.event_pass_duration_hours,
  uep.purchased_at,
  uep.activated_at,
  uep.event_id
FROM user_event_passes uep
JOIN subscription_tiers st ON uep.tier_id = st.id
WHERE uep.user_id = 'user-uuid-here';

-- Test validation function
SELECT * FROM validate_event_time_restrictions(
  'user-uuid',
  NOW(),      -- start datetime
  NOW() + interval '2 days',  -- end datetime
  NULL        -- pass ID
);
```

---

## Summary

1. **Always check subscription type** before showing event creation UI
2. **Always validate** before saving events
3. **SmugMug = Admin only** - check role before showing component
4. **Clear messaging** - show users what type of account they have
5. **Enforce at database level** - validation functions ensure data integrity

For detailed business rules, see `SUBSCRIPTION_VS_EVENT_PASS.md`.
