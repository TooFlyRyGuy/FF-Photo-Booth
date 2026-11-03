/*
# Add gemini_model column to events

Per-event Gemini image model. NULL means the event uses global_settings.gemini_model.
No backfill and no default — existing events keep using the account model.
*/

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS gemini_model text NULL;

COMMENT ON COLUMN public.events.gemini_model IS 'NULL = use global_settings.gemini_model';
