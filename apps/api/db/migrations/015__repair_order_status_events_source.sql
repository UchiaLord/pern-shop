-- 015__repair_order_status_events_source.sql
-- Repair migration: some environments marked 014 as applied but are missing column(s).
-- This file is intentionally idempotent.

ALTER TABLE order_status_events
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Optional but recommended: ensure existing rows have a sensible default.
UPDATE order_status_events
SET source = 'system'
WHERE source IS NULL;
