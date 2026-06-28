CREATE TABLE event_error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_error_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users (event owners) can read errors for their own events
CREATE POLICY "select_own_event_errors" ON event_error_logs FOR SELECT
  TO authenticated USING (
    event_id IN (SELECT id FROM events WHERE user_id = auth.uid())
  );

-- Admins can read all errors
CREATE POLICY "admin_select_all_errors" ON event_error_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Kiosk runs as anon; allow anon inserts so booth errors are always captured
CREATE POLICY "anon_insert_errors" ON event_error_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Index for fast per-event lookups
CREATE INDEX event_error_logs_event_id_idx ON event_error_logs (event_id, created_at DESC);
