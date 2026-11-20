-- Per-prompt overlay override for an event's prompt link.
-- overlay_mode: 'event' = use the event overlay (default), 'custom' = use overlay_url, 'none' = no overlay.
-- Additive only: existing rows get overlay_mode = 'event', which matches current behavior.
ALTER TABLE public.event_prompts
  ADD COLUMN IF NOT EXISTS overlay_mode text NOT NULL DEFAULT 'event'
    CONSTRAINT event_prompts_overlay_mode_check CHECK (overlay_mode IN ('event', 'custom', 'none')),
  ADD COLUMN IF NOT EXISTS overlay_url text NULL;
