/*
  # Create Webhook Events Logging System
  
  1. New Table
    - `webhook_events`
      - `id` (uuid, primary key)
      - `event_id` (text, unique) - Stripe event ID for deduplication
      - `event_type` (text) - Type of Stripe event
      - `payload` (jsonb) - Full event payload
      - `processing_status` (text) - pending, processing, completed, failed
      - `error_message` (text, nullable) - Error details if failed
      - `user_id` (uuid, nullable) - Associated user if identified
      - `customer_id` (text, nullable) - Stripe customer ID
      - `received_at` (timestamptz) - When webhook was received
      - `processing_started_at` (timestamptz, nullable) - When processing began
      - `processing_completed_at` (timestamptz, nullable) - When processing finished
      - `retry_count` (integer) - Number of retry attempts
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Admin-only access for viewing webhook events
  
  3. Indexes
    - Index on event_id for fast deduplication checks
    - Index on processing_status for filtering
    - Index on created_at for chronological queries
    - Index on customer_id for customer lookups
*/

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  error_message text,
  user_id uuid REFERENCES auth.users(id),
  customer_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admins can view all webhook events"
  ON webhook_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_customer_id ON webhook_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON webhook_events(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS webhook_events_updated_at ON webhook_events;
CREATE TRIGGER webhook_events_updated_at
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_events_updated_at();
