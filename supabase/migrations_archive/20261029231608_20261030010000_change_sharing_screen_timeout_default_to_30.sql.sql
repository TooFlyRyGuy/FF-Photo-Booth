/*
# Change default sharing_screen_timeout from 15 to 30 seconds

1. Purpose
   Updates the default sharing screen timeout from 15 seconds to 30 seconds
   so all events (existing and new) use 30 seconds unless explicitly changed.

2. Changes
   - Alters the column default on `events.sharing_screen_timeout` to 30.
   - Updates all existing rows that are currently set to 15 (the old default)
     to 30, so legacy events pick up the new default. Rows explicitly set to
     other values are preserved.
*/

ALTER TABLE events ALTER COLUMN sharing_screen_timeout SET DEFAULT 30;

UPDATE events SET sharing_screen_timeout = 30 WHERE sharing_screen_timeout = 15;
