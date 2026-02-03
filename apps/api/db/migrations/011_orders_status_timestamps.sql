-- 011_orders_status_timestamps.sql
-- Add status timestamps for fulfillment lifecycle:
-- paid_at, shipped_at, completed_at

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL;

COMMIT;