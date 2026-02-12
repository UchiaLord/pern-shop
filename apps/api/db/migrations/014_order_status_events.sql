-- apps/api/db/migrations/014_order_status_events.sql
-- Day 32: Order Status Timeline / Audit Trail
-- Safe to run multiple times (handles pre-existing table/columns)

CREATE TABLE IF NOT EXISTS order_status_events (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT NULL,
  to_status TEXT NOT NULL,
  reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if an older version of the table exists
ALTER TABLE order_status_events
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Ensure metadata default exists (older tables may have null or missing default)
ALTER TABLE order_status_events
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

-- Backfill null metadata to {}
UPDATE order_status_events
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

-- Backfill source when missing/null
UPDATE order_status_events
SET source = 'system'
WHERE source IS NULL;

-- Enforce source domain (only after backfill)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_status_events_source_check'
  ) THEN
    ALTER TABLE order_status_events
      ADD CONSTRAINT order_status_events_source_check
      CHECK (source IN ('system', 'admin', 'webhook'));
  END IF;
END
$$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_order_status_events_order_id_created_at
  ON order_status_events(order_id, created_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_order_status_events_created_at
  ON order_status_events(created_at ASC, id ASC);
