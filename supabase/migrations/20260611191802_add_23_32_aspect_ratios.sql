ALTER TABLE events DROP CONSTRAINT events_aspect_ratio_check;
ALTER TABLE events ADD CONSTRAINT events_aspect_ratio_check
  CHECK (aspect_ratio IN ('square', '3:4', '4:3', '9:16', '16:9', '2:3', '3:2'));