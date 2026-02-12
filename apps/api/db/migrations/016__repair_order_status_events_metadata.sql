-- 016__repair_order_status_events_metadata.sql
-- Repair migration: environments that marked 014 as applied but are missing columns.
-- Intentionally idempotent.

-- jsonb metadata for timeline/event context
ALTER TABLE order_status_events
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- If you want a safe default for existing rows:
UPDATE order_status_events
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

-- Optional but commonly desired: basic index for admin timeline queries
-- (harmless if it already exists)
CREATE INDEX IF NOT EXISTS order_status_events_order_id_created_at_idx
  ON order_status_events (order_id, created_at);
