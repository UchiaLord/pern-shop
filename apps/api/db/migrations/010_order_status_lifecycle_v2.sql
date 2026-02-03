-- 010_order_status_lifecycle_v2.sql
-- Align DB constraint with application lifecycle:
-- pending -> paid -> shipped -> completed
-- pending/paid -> cancelled
--
-- Also normalize spelling: cancelled (double-l)

BEGIN;

-- 1) Normalize any legacy values if present
UPDATE orders
SET status = 'pending'
WHERE status IN ('created');

-- Normalize US spelling if it ever exists
UPDATE orders
SET status = 'cancelled'
WHERE status = 'canceled';

-- Normalize old failure state (if you used it)
-- You can decide if 'failed' should remain separate later;
-- for now map it to 'cancelled' to keep lifecycle simple.
UPDATE orders
SET status = 'cancelled'
WHERE status = 'failed';

-- 2) Set default
ALTER TABLE orders
  ALTER COLUMN status SET DEFAULT 'pending';

-- 3) Enforce allowed values
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_chk;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_chk
  CHECK (status IN ('pending', 'paid', 'shipped', 'completed', 'cancelled'));

COMMIT;