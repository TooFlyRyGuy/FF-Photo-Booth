# Project memory

## Product intent & audience

- **AI Booth admin** for **Fun Frame Photo** — event/photo-booth management app with admin-controlled events, start/end time locks, and pass activation.
- Public-facing marketing page with social link previews (og/twitter tags).
- Admin-controlled **AI image generation** via a Supabase edge function calling Google Gemini.

## Brand personality & voice

- Brand is **Fun Frame / Fun Frame Photo**, not Bolt. Link previews, images, titles, and descriptions must reflect Fun Frame branding.

## Visual design & UX direction

- Event editor uses a `TimezoneDateTimePicker` component for Start/End times.
- Default event timezone: **America/Los_Angeles**.
- Typed wall-clock times must round-trip exactly (save → reopen → re-save) with no shift.

## Decisions, constraints & rationale

- **Stack:** Vite + React; backend is **Supabase** (Postgres migrations, triggers, RPC functions, edge functions).
- **Database conventions:**
  - `public.is_admin()` (no-arg) and `public.is_admin(p_user_id uuid)` overload both required; trigger `prevent_start_time_change_with_activated_pass` calls `is_admin(auth.uid())`.
  - Admin check reads `user_profiles` where `role = 'admin'`.
  - Migrations live in `supabase/migrations/`; never duplicate an already-applied migration — use idempotent `CREATE OR REPLACE FUNCTION`.
- **Timezone fix rationale:** `createDateTimeInTimezone` previously double-converted (browser local → target tz string → misread as UTC), causing an 8-hour shift. Correct behavior: interpret input as wall-clock in target tz and produce the matching UTC instant without involving browser local tz. `dateToLocalInputValue` was already correct and left unchanged.
- **Link preview fix:** `index.html` og:image/twitter:image pointed to `bolt.new/static/og_default.png`; replaced with Fun Frame image and added og:title/description/url.
- **Gemini safety settings relaxed:** Edge function `supabase/functions/gemini-generate-image/index.ts` sets all four harm categories to `"BLOCK_NONE"` in the Gemini request body. Rationale: prompts like "Snowboard surfing" were incorrectly refused; app is admin-controlled so safety filtering is unnecessary. Error message improved to surface `promptFeedback.blockReason` if a block still occurs.

## Open questions & assumptions

- Assumes connected Supabase project is the target environment for migration and edge-function deployment.
- Assumes a Fun Frame OG image asset is available (e.g., `/smaller700x200_logo.png`) or a dedicated one should be created.
- Verification still pending in build mode: timezone round-trip tests, Fun Frame og tags, and Gemini generation with relaxed safety settings after redeploy.