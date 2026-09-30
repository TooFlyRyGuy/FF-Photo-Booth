/*
# Add sharing options (SMS toggle, WhatsApp, Email) to events + SMTP to global_settings

## Summary
Adds per-event toggles for SMS, WhatsApp, and Email sharing, plus customizable
per-event email subject and HTML body. Adds platform-wide SMTP configuration
columns to global_settings for sending those emails.

## 1. New columns on `events`
- `sms_enabled` (boolean, NOT NULL, DEFAULT true)
  Whether the SMS sharing option appears on this event's kiosk sharing screen.
  Defaults to true so all existing events keep SMS on until an organizer turns it off.
- `whatsapp_enabled` (boolean, NOT NULL, DEFAULT false)
  Whether the WhatsApp sharing option appears on this event's kiosk sharing screen.
- `email_enabled` (boolean, NOT NULL, DEFAULT false)
  Whether the Email sharing option appears on this event's kiosk sharing screen.
- `email_subject` (text, nullable)
  Custom email subject template for this event. Supports placeholders {event_name} and {image_url}.
- `email_body` (text, nullable)
  Custom email body template for this event, accepts raw HTML.
  Supports placeholders {event_name} and {image_url}.

## 2. New columns on `global_settings`
- `smtp_host` (text, nullable) — SMTP server hostname.
- `smtp_port` (integer, nullable) — SMTP server port (e.g. 587, 465, 25).
- `smtp_username` (text, nullable) — SMTP auth username.
- `smtp_password` (text, nullable) — SMTP auth password (server-side only, never returned to browser).
- `smtp_from_email` (text, nullable) — From address for outgoing emails.
- `smtp_from_name` (text, nullable) — From display name for outgoing emails.
- `smtp_enabled` (boolean, NOT NULL, DEFAULT false) — Master toggle for email delivery.

## 3. Security
- No RLS or policy changes. The new event columns are read/written through the
  same existing event policies. The new global_settings columns are read/written
  through the same existing global_settings policies. The SMTP password is only
  ever read by the service role inside edge functions, never returned to the
  browser (the backend service exposes only a `smtpPasswordSet` boolean sentinel).
*/

-- Event sharing columns
ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "sms_enabled" boolean NOT NULL DEFAULT true;

ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "whatsapp_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "email_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "email_subject" text;

ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "email_body" text;

-- Backfill: ensure existing events have SMS enabled (matches the DEFAULT true)
UPDATE "public"."events"
  SET "sms_enabled" = true
  WHERE "sms_enabled" IS NULL;

-- SMTP columns on global_settings
ALTER TABLE "public"."global_settings"
  ADD COLUMN IF NOT EXISTS "smtp_host" text;

ALTER TABLE "public"."global_settings"
  ADD COLUMN IF NOT EXISTS "smtp_port" integer;

ALTER TABLE "public"."global_settings"
  ADD COLUMN IF NOT EXISTS "smtp_username" text;

ALTER TABLE "public"."global_settings"
  ADD COLUMN IF NOT EXISTS "smtp_password" text;

ALTER TABLE "public"."global_settings"
  ADD COLUMN IF NOT EXISTS "smtp_from_email" text;

ALTER TABLE "public"."global_settings"
  ADD COLUMN IF NOT EXISTS "smtp_from_name" text;

ALTER TABLE "public"."global_settings"
  ADD COLUMN IF NOT EXISTS "smtp_enabled" boolean NOT NULL DEFAULT false;
