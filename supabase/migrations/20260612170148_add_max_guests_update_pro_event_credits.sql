-- Add max_guests column to event_passes
ALTER TABLE event_passes ADD COLUMN IF NOT EXISTS max_guests integer;

-- Set guest capacity for each pass
UPDATE event_passes SET max_guests = 50 WHERE name = 'Starter Event';
UPDATE event_passes SET max_guests = 150 WHERE name = 'Pro Event';
UPDATE event_passes SET max_guests = 400 WHERE name = 'Premium Event';
UPDATE event_passes SET max_guests = 750 WHERE name = 'Platinum Event';

-- Update Pro Event credits
UPDATE event_passes SET credits = 600, sms_credits = 600 WHERE name = 'Pro Event';
