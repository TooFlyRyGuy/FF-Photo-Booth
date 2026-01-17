# Integration Guide: New Components and Features

## Quick Start

All the core functionality has been implemented. Here's how to integrate the new components into your UI.

---

## 1. Fix BB Test Event (Immediate Action)

The BB Test event now has `created_by` set correctly, so you can manually link its SmugMug gallery.

### Option A: Using the SmugMugGallerySync Component

Add this to your event editing form (e.g., in AdminDashboard.tsx):

```tsx
import { SmugMugGallerySync } from './SmugMugGallerySync';
import { syncSmugMugGallery, createSmugMugGalleryForEvent } from '../services/backendService';

// In your event editing form, add:
<SmugMugGallerySync
  eventId={editingEvent.id}
  eventName={editingEvent.name}
  currentGalleryKey={editingEvent.smugmugGalleryKey}
  currentGalleryUrl={editingEvent.smugmugGalleryUrl}
  onSync={async (galleryKey, galleryUrl) => {
    await syncSmugMugGallery(editingEvent.id, galleryKey, galleryUrl);
    await loadData(); // Refresh your data
  }}
  onCreateNew={async () => {
    const result = await createSmugMugGalleryForEvent(
      editingEvent.id,
      editingEvent.name,
      editingEvent.city
    );
    await loadData(); // Refresh your data
    return result;
  }}
/>
```

### Option B: Direct Database Update

If you know the gallery key and URL from SmugMug, you can update directly:

```sql
UPDATE events
SET
  smugmug_gallery_key = '/api/v2/album/YOUR_ALBUM_KEY',
  smugmug_gallery_url = 'https://www.smugmug.com/YOUR/GALLERY/URL'
WHERE id = '2ad31572-af04-4788-b255-39ccddb8da9f';
```

---

## 2. Add Timezone Support to Settings

### Step 1: Detect and Set User Timezone

Add to your signup/login flow or user settings:

```tsx
import { detectUserTimezone } from '../services/timezoneService';
import { updateUserTimezone } from '../services/backendService';

// On signup or first login:
const detectedTimezone = detectUserTimezone();
await updateUserTimezone(detectedTimezone);
```

### Step 2: Add Timezone Selector to Settings

In your Settings component:

```tsx
import { detectUserTimezone } from '../services/timezoneService';
import { getUserProfile, updateUserTimezone } from '../services/backendService';

function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [timezone, setTimezone] = useState('UTC');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const userProfile = await getUserProfile();
    setProfile(userProfile);
    setTimezone(userProfile.timezone || 'UTC');
  };

  const handleDetectTimezone = () => {
    const detected = detectUserTimezone();
    setTimezone(detected);
  };

  const handleSaveTimezone = async () => {
    await updateUserTimezone(timezone);
    alert('Timezone updated successfully!');
  };

  return (
    <div>
      <h3>Timezone Settings</h3>
      <div>
        <label>Your Timezone</label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="America/New_York"
        />
      </div>
      <button onClick={handleDetectTimezone}>
        Auto-Detect Timezone
      </button>
      <button onClick={handleSaveTimezone}>
        Save Timezone
      </button>
      <p className="text-sm text-gray-500">
        Current: {timezone}
      </p>
    </div>
  );
}
```

---

## 3. Add Event Pass Selection to Event Creation

In your event creation form (e.g., AdminDashboard.tsx):

```tsx
import { EventPassSelector } from './EventPassSelector';

function EventForm() {
  const [event, setEvent] = useState<Event>({...});
  const [userTimezone, setUserTimezone] = useState('UTC');

  useEffect(() => {
    // Load user timezone
    getUserProfile().then(profile => {
      setUserTimezone(profile.timezone || 'UTC');
    });
  }, []);

  return (
    <form>
      {/* Existing event fields */}

      {/* Add Event Pass Selector */}
      <EventPassSelector
        timezone={userTimezone}
        selectedPassId={event.passId}
        startDatetime={event.startDatetime}
        onSelectPass={(passId, expiresAt) => {
          setEvent({
            ...event,
            passId,
            passExpiresAt: expiresAt,
            // Auto-set end datetime to pass expiration
            endDatetime: expiresAt,
          });
        }}
      />

      {/* Rest of form */}
    </form>
  );
}
```

---

## 4. Use Timezone-Aware DateTime Pickers

Replace standard datetime-local inputs with TimezoneDateTimePicker:

```tsx
import { TimezoneDateTimePicker } from './TimezoneDateTimePicker';

function EventForm() {
  const [event, setEvent] = useState<Event>({...});
  const [userTimezone, setUserTimezone] = useState('UTC');

  return (
    <form>
      {/* Start Date/Time */}
      <TimezoneDateTimePicker
        label="Event Start"
        value={event.startDatetime}
        timezone={userTimezone}
        onChange={(isoString) => {
          setEvent({ ...event, startDatetime: isoString });
        }}
        required
        helperText="Event will become active at this time"
      />

      {/* End Date/Time */}
      <TimezoneDateTimePicker
        label="Event End"
        value={event.endDatetime}
        timezone={userTimezone}
        onChange={(isoString) => {
          setEvent({ ...event, endDatetime: isoString });
        }}
        minDate={event.startDatetime}
        helperText="Event will automatically deactivate at this time"
      />
    </form>
  );
}
```

---

## 5. Activate Event Pass on Event Creation

Update your event creation handler:

```tsx
import { saveEvent, activateEventPass } from '../services/backendService';

const handleCreateEvent = async () => {
  try {
    // Create the event
    const savedEvent = await saveEvent(event);

    // If a pass was selected, activate it
    if (event.passId) {
      await activateEventPass(event.passId, savedEvent.id);
      console.log('Event pass activated successfully');
    }

    alert('Event created successfully!');
    await loadData();
  } catch (error: any) {
    alert(`Failed to create event: ${error.message}`);
    console.error('Event creation error:', error);
  }
};
```

---

## 6. Display Pass Information

Show pass status and countdown in event details:

```tsx
import { getTimeRemaining, formatDateTimeInTimezone } from '../services/timezoneService';

function EventDetails({ event, timezone }: { event: Event; timezone: string }) {
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

  if (!event.passExpiresAt) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 className="font-semibold text-blue-900">Event Pass Active</h4>
      <p className="text-sm text-blue-700">
        Expires: {formatDateTimeInTimezone(event.passExpiresAt, timezone)}
      </p>
      {timeRemaining && timeRemaining.total > 0 && (
        <p className="text-sm text-blue-700 mt-1">
          Time remaining: {timeRemaining.days}d {timeRemaining.hours}h{' '}
          {timeRemaining.minutes}m {timeRemaining.seconds}s
        </p>
      )}
      {timeRemaining && timeRemaining.total <= 0 && (
        <p className="text-sm text-red-700 mt-1">
          Pass has expired
        </p>
      )}
    </div>
  );
}
```

---

## 7. Format Dates Throughout Your App

Replace hard-coded date formatting with timezone-aware formatting:

```tsx
import { formatDateTimeInTimezone, formatTimeInTimezone } from '../services/timezoneService';

// Before:
<p>{new Date(event.startDatetime).toLocaleString()}</p>

// After:
<p>{formatDateTimeInTimezone(event.startDatetime, userTimezone)}</p>
// Output: "1/15/2026, 2:00 PM PST"

// Time only:
<p>{formatTimeInTimezone(event.startDatetime, userTimezone)}</p>
// Output: "2:00 PM PST"
```

---

## 8. SmugMug Gallery in Event List

Show SmugMug gallery status in event list:

```tsx
function EventListItem({ event }: { event: Event }) {
  return (
    <div>
      <h3>{event.name}</h3>

      {event.smugmugGalleryUrl ? (
        <a
          href={event.smugmugGalleryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700"
        >
          View SmugMug Gallery
        </a>
      ) : (
        <span className="text-gray-500 text-sm">
          No gallery linked
        </span>
      )}
    </div>
  );
}
```

---

## 9. Automatic Timezone Detection on Login

Add to your login/signup success handler:

```tsx
import { detectUserTimezone } from '../services/timezoneService';
import { updateUserTimezone, getUserProfile } from '../services/backendService';

async function handleLoginSuccess() {
  // Get user profile
  const profile = await getUserProfile();

  // If no timezone set, detect and save
  if (!profile.timezone || profile.timezone === 'UTC') {
    const detectedTimezone = detectUserTimezone();
    if (detectedTimezone !== 'UTC') {
      await updateUserTimezone(detectedTimezone);
      console.log('Timezone auto-detected:', detectedTimezone);
    }
  }
}
```

---

## 10. Testing Checklist

### SmugMug Gallery Fix
- [ ] BB Test event shows created_by is set
- [ ] Can manually link gallery using SmugMugGallerySync component
- [ ] Create new event and verify gallery is saved
- [ ] Update existing event and verify gallery link persists

### Timezone Support
- [ ] Timezone auto-detection works on signup
- [ ] Can manually set timezone in settings
- [ ] All dates display in user's timezone
- [ ] Timezone abbreviation shows correctly (PST, EST, etc.)
- [ ] DateTime picker converts properly to/from UTC

### Event Pass Management
- [ ] Can view available event passes
- [ ] Can select pass when creating event
- [ ] Pass expiration calculates correctly
- [ ] Pass is activated after event creation
- [ ] Countdown timer shows remaining time
- [ ] Event deactivates when pass expires

### RLS and Permissions
- [ ] Authenticated users can save images in kiosk mode
- [ ] Anonymous users can save images in kiosk mode
- [ ] Event owners can update their events
- [ ] Admin can update all events
- [ ] Users cannot update events they don't own

---

## Common Issues and Solutions

### Issue: Timezone shows as UTC instead of detected timezone
**Solution:** Make sure to call `updateUserTimezone()` after detecting timezone. Check that the user_profiles table has the timezone column.

### Issue: Pass selection doesn't show any passes
**Solution:** User needs to purchase event passes first. Check `user_event_passes` table for passes with NULL `activated_at`.

### Issue: SmugMug gallery link doesn't save
**Solution:** Verify `created_by` field is set. Check that RLS policies allow UPDATE. Check browser console for errors.

### Issue: DateTime picker shows wrong time
**Solution:** Ensure you're passing the correct timezone. Check that dates are stored as ISO strings in UTC.

### Issue: Pass expiration calculation is wrong
**Solution:** Verify `event_pass_duration_hours` is set in subscription_tiers table. Check that `addHours()` function is working correctly.

---

## Next Steps

1. **Immediate:** Fix BB Test event by manually linking the SmugMug gallery
2. **Short-term:** Add SmugMugGallerySync component to event editing UI
3. **Short-term:** Add EventPassSelector to event creation UI
4. **Medium-term:** Add timezone selector to user settings
5. **Medium-term:** Replace all datetime inputs with TimezoneDateTimePicker
6. **Long-term:** Add email notifications for pass expiration
7. **Long-term:** Add admin dashboard for pass usage analytics

---

## Support Files

- **IMPLEMENTATION_SUMMARY.md** - Detailed technical documentation
- **services/timezoneService.ts** - All timezone utility functions
- **components/SmugMugGallerySync.tsx** - Gallery management component
- **components/TimezoneDateTimePicker.tsx** - Timezone-aware datetime input
- **components/EventPassSelector.tsx** - Pass selection component

---

## Questions?

Refer to:
1. IMPLEMENTATION_SUMMARY.md for technical details
2. Function JSDoc comments in service files
3. Component prop types for usage examples
4. Migration files for database schema changes
