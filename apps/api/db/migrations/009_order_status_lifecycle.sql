-- 009_order_status_lifecycle.sql
-- Goal: normalize order status lifecycle to:
-- pending | paid | canceled | failed
--
-- Previous default: 'created' (legacy)

BEGIN;

-- 1) Normalize existing rows
UPDATE orders
SET status = 'pending'
WHERE status = 'created';

-- 2) Set new default
ALTER TABLE orders
  ALTER COLUMN status SET DEFAULT 'pending';

-- 3) Enforce allowed values
-- Drop old constraint if you ever added one (safe if not exists)
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_chk;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_chk
  CHECK (status IN ('pending', 'paid', 'canceled', 'failed'));

COMMIT;