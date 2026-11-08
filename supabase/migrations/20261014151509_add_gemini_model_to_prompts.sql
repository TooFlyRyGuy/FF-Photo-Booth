/*
# Add gemini_model column to prompts table

## Purpose
Allows per-prompt Gemini model override. When set, this prompt uses the specified
model instead of the event-level or account-level default.

## Changes to `prompts` table
- `gemini_model` (text, nullable): Per-prompt Gemini image model. NULL means use
  the event-level model (events.gemini_model), which itself falls back to the
  account-level model (global_settings.gemini_model).

## Security
- No new tables created.
- No RLS policy changes — existing prompt policies already govern access.
- New column is nullable with no default so existing rows are unaffected.
*/

ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS gemini_model text NULL;

COMMENT ON COLUMN public.prompts.gemini_model IS 'NULL = use event-level or account-level model';
