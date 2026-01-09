BEGIN;

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'created',
  currency TEXT NOT NULL DEFAULT 'EUR',
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS order_items (
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  sku TEXT NOT NULL,
  name TEXT NOT NULL,

  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',

  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

COMMIT;
