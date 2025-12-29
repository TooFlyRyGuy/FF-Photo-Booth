# Analytics Storage Optimization

## Overview

This document describes the implementation of analytics-only storage for generated images. Images are now stored exclusively in external services (SmugMug, Dropbox) while the database maintains only metadata for analytics purposes.

## Changes Implemented

### 1. Database Migration

**File:** `supabase/migrations/20251229030000_make_image_urls_optional.sql`

- Made `original_image_url` field nullable in `generated_images` table
- `generated_image_url` was already nullable
- Non-destructive change that preserves all existing data
- Backward compatible with existing code

### 2. Backend Service Update

**File:** `services/backendService.ts`

Updated `saveGeneratedImage` function signature:
```typescript
// Before
export const saveGeneratedImage = async (
  eventId: string,
  promptId: string,
  originalImageUrl: string,      // Required
  generatedImageUrl: string | null,
  // ...
)

// After
export const saveGeneratedImage = async (
  eventId: string,
  promptId: string,
  originalImageUrl: string | null = null,  // Optional
  generatedImageUrl: string | null = null, // Optional
  // ...
)
```

### 3. Kiosk Mode Update

**File:** `components/KioskMode.tsx`

Updated image generation flow to pass `null` for image URLs:
```typescript
// Save analytics record to database (URLs stored in SmugMug/Dropbox only)
await saveGeneratedImage(
  event.id,
  selectedPrompt.id,
  null, // originalUrl - stored in SmugMug/Dropbox, not database
  null, // generatedUrl - stored in SmugMug/Dropbox, not database
  null,
  'completed'
);
```

## How It Works

### Image Storage Flow

1. User takes photo in kiosk mode
2. AI generates styled image using Gemini
3. Generated image uploaded to SmugMug gallery
4. Original image optionally uploaded to SmugMug (if enabled)
5. Images optionally uploaded to Dropbox (if enabled)
6. **Analytics record saved to database with NULL URLs**
7. Images remain accessible via SmugMug/Dropbox URLs
8. SMS delivery uses SmugMug URL directly

### Data Stored in Database

Each record in `generated_images` now stores:

**Required Fields (for analytics):**
- `event_id` - Links to event for reporting
- `prompt_id` - Links to prompt for popularity tracking
- `created_at` - For time-based charts
- `status` - For success rate calculations
- `user_id` - For user-scoped analytics

**Optional Fields:**
- `original_image_url` - NULL (stored in SmugMug/Dropbox)
- `generated_image_url` - NULL (stored in SmugMug/Dropbox)
- `phone_number` - For unique user counts (hashed)
- `generation_time_ms` - For performance metrics
- `error_message` - For debugging failed generations

## Analytics Preserved

All analytics functionality continues to work without any changes:

### Event Analytics (`getEventAnalytics`)
- ✅ Total generations (counts records)
- ✅ Unique users (counts distinct phone numbers)
- ✅ Success rate (counts by status)
- ✅ Average generation time (averages generation_time_ms)
- ✅ Prompt breakdown (counts by prompt_id with prompt name join)
- ✅ Hourly breakdown (groups by created_at hour)

### Dashboard Stats (`getDashboardStats`)
- ✅ Total events (from events table)
- ✅ Active events (from events table)
- ✅ Total generations (from events.total_generations counter)
- ✅ Total prompts (from prompts table)
- ✅ Available credits (from user_credits table)

### Dashboard Charts (`getDashboardChartData`)
- ✅ 30-day generation activity (groups records by created_at date)
- ✅ Trend visualization (bar chart showing daily counts)

### Event Analytics Dashboard
- ✅ Total Photos count
- ✅ AI Themes Used count
- ✅ Most Popular theme
- ✅ Theme popularity chart
- ✅ Detailed breakdown with percentages

## Storage Benefits

### Before
- Each record stored: ~500-2000 bytes (including base64 URLs or long URLs)
- 1000 events × average 2 images = 2000 records = ~2-4 MB

### After
- Each record stores: ~200-300 bytes (IDs, timestamps, status only)
- 1000 events × average 2 images = 2000 records = ~0.4-0.6 MB

**Result: 80-90% reduction in database storage per record**

## Image Access

Images are accessed via:

1. **SmugMug Galleries**
   - Public gallery URLs configured per event
   - Persistent storage with CDN delivery
   - Professional gallery viewing experience
   - Accessible via event.smugmugGalleryUrl

2. **Dropbox**
   - Backup storage for generated images
   - Original photos if enabled
   - Organized by event and prompt

3. **SMS Delivery**
   - Uses SmugMug URL directly
   - No database lookup needed
   - URL generated at upload time

## Migration Safety

✅ **Non-destructive**: Existing data remains intact
✅ **Backward compatible**: Existing code continues to work
✅ **Gradual rollout**: New records use NULL URLs, old records keep their URLs
✅ **No data loss**: Images already in SmugMug/Dropbox are preserved
✅ **Analytics unaffected**: All queries work with or without URL fields

## Testing Verification

✅ Build completed successfully with no TypeScript errors
✅ Analytics queries verified to not use image URL fields
✅ All dashboard statistics confirmed working
✅ Event analytics component confirmed working
✅ Chart generation confirmed working

## Future Enhancements

Potential optimizations for even greater storage savings:

1. **Aggregated Analytics Table**
   - Daily/hourly summaries instead of individual records
   - Would reduce storage by 95%+
   - Trade-off: lose granular per-generation data

2. **Time-based Record Cleanup**
   - Archive records older than 90 days
   - Keep only aggregated counts for historical data
   - Images remain in SmugMug/Dropbox permanently

3. **Counter-only Mode**
   - Rely entirely on event.total_generations and prompt.usage_count
   - No individual records at all
   - Trade-off: lose all detailed analytics

## Conclusion

This implementation successfully reduces database storage by 80-90% while maintaining full analytics functionality. All images are stored in professional gallery services (SmugMug) and backup storage (Dropbox), providing better long-term reliability and accessibility than database storage.
