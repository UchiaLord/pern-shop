-- apps/api/db/migrations/030_add_payment_intent_id.sql
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

-- Enforce: one PaymentIntent belongs to at most one order
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_intent_id_uq
ON orders(payment_intent_id)
WHERE payment_intent_id IS NOT NULL;
