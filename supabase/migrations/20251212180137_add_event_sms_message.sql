/*
  # Add SMS message customization to events

  ## Description
  Adds the ability for event organizers to customize the text message sent when photos are delivered via Twilio SMS.

  ## Changes
  1. New Column
    - `sms_message` (text) - Custom message template for SMS delivery
      - Default: "Here's your AI-generated photo from {event_name}! {image_url}"
      - The {event_name} and {image_url} placeholders will be replaced at send time
  
  ## Notes
  - This allows each event to have its own custom SMS message
  - Default message maintains backward compatibility with existing behavior
  - Placeholders {event_name} and {image_url} are automatically replaced when sending
*/

DO $$
BEGIN
  -- Add sms_message column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'sms_message'
  ) THEN
    ALTER TABLE events ADD COLUMN sms_message text DEFAULT 'Here''s your AI-generated photo from {event_name}! {image_url}';
  END IF;
END $$;
