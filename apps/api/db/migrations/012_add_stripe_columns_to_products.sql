-- apps/api/db/migrations/009_add_stripe_catalog_ids.sql

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- optional, aber sinnvoll: keine Duplikate (wenn gesetzt)
CREATE UNIQUE INDEX IF NOT EXISTS products_stripe_product_id_uniq
  ON products (stripe_product_id)
  WHERE stripe_product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_stripe_price_id_uniq
  ON products (stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;