// apps/api/src/db/repositories/product-repository.js
import { pool } from '../pool.js';
import { HttpError } from '../../errors/http-error.js';

/**
 * Mapping DB row -> API shape (camelCase)
 * Enthält Stripe-IDs (für Admin/Sync), aber Web-Routes können sie bewusst ausblenden.
 */
function mapProductRow(p) {
  return {
    id: Number(p.id),
    sku: p.sku,
    name: p.name,
    description: p.description,
    priceCents: Number(p.price_cents),
    currency: p.currency,
    isActive: Boolean(p.is_active),
    createdAt: p.created_at,
    updatedAt: p.updated_at,

    // Stripe mapping (nullable)
    stripeProductId: p.stripe_product_id ?? null,
    stripePriceId: p.stripe_price_id ?? null,
  };
}

/**
 * Public: list only active products
 */
export async function listActiveProducts() {
  const res = await pool.query(
    `
    SELECT
      id, sku, name, description, price_cents, currency, is_active,
      created_at, updated_at,
      stripe_product_id, stripe_price_id
    FROM products
    WHERE is_active = true
    ORDER BY id DESC
    `,
  );

  return res.rows.map(mapProductRow);
}

/**
 * Admin: list all products (including inactive)
 */
export async function listAllProducts() {
  const res = await pool.query(
    `
    SELECT
      id, sku, name, description, price_cents, currency, is_active,
      created_at, updated_at,
      stripe_product_id, stripe_price_id
    FROM products
    ORDER BY id DESC
    `,
  );

  return res.rows.map(mapProductRow);
}

/**
 * Public: get ONLY active product by id
 * @returns {null | Product}
 */
export async function getActiveProductById(id) {
  const res = await pool.query(
    `
    SELECT
      id, sku, name, description, price_cents, currency, is_active,
      created_at, updated_at,
      stripe_product_id, stripe_price_id
    FROM products
    WHERE id = $1 AND is_active = true
    `,
    [Number(id)],
  );

  if (res.rowCount === 0) return null;
  return mapProductRow(res.rows[0]);
}

/**
 * Admin: get product by id (active or inactive)
 * @returns {null | Product}
 */
export async function getProductByIdAdmin(id) {
  const res = await pool.query(
    `
    SELECT
      id, sku, name, description, price_cents, currency, is_active,
      created_at, updated_at,
      stripe_product_id, stripe_price_id
    FROM products
    WHERE id = $1
    `,
    [Number(id)],
  );

  if (res.rowCount === 0) return null;
  return mapProductRow(res.rows[0]);
}

/**
 * Backward helper (falls irgendwo verwendet)
 */
export async function getProductById(id) {
  return getProductByIdAdmin(id);
}

/**
 * Admin: create product (DB only)
 * input: { sku, name, description, priceCents, currency, isActive }
 */
export async function createProduct(input) {
  const sku = String(input.sku ?? '').trim();
  const name = String(input.name ?? '').trim();

  if (!sku) {
    throw new HttpError({ status: 400, code: 'VALIDATION_ERROR', message: 'SKU fehlt.' });
  }
  if (!name) {
    throw new HttpError({ status: 400, code: 'VALIDATION_ERROR', message: 'Name fehlt.' });
  }

  const priceCents = Number(input.priceCents);
  if (!Number.isFinite(priceCents) || priceCents < 0 || !Number.isInteger(priceCents)) {
    throw new HttpError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'priceCents muss eine ganze Zahl >= 0 sein.',
    });
  }

  const currency = String(input.currency ?? 'EUR').trim() || 'EUR';
  const isActive = input.isActive === undefined ? true : Boolean(input.isActive);
  const description = input.description === undefined ? null : input.description;

  try {
    const res = await pool.query(
      `
      INSERT INTO products (sku, name, description, price_cents, currency, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id, sku, name, description, price_cents, currency, is_active,
        created_at, updated_at,
        stripe_product_id, stripe_price_id
      `,
      [sku, name, description, priceCents, currency, isActive],
    );

    return mapProductRow(res.rows[0]);
  } catch (e) {
    throw new HttpError({
      status: 400,
      code: 'PRODUCT_CREATE_FAILED',
      message: 'Produkt konnte nicht erstellt werden.',
      details: { reason: e?.message ?? String(e) },
    });
  }
}

/**
 * Admin: update by id (used by routes/products.js PATCH)
 * input: partial { sku, name, description, priceCents, currency, isActive }
 */
export async function updateProductById(id, input) {
  const current = await getProductByIdAdmin(id);
  if (!current) return null;

  const next = {
    sku: input.sku !== undefined ? String(input.sku).trim() : current.sku,
    name: input.name !== undefined ? String(input.name).trim() : current.name,
    description: input.description !== undefined ? input.description : current.description,
    priceCents: input.priceCents !== undefined ? Number(input.priceCents) : current.priceCents,
    currency: input.currency !== undefined ? String(input.currency).trim() : current.currency,
    isActive: input.isActive !== undefined ? Boolean(input.isActive) : current.isActive,
  };

  if (!next.sku) {
    throw new HttpError({ status: 400, code: 'VALIDATION_ERROR', message: 'SKU darf nicht leer sein.' });
  }
  if (!next.name) {
    throw new HttpError({ status: 400, code: 'VALIDATION_ERROR', message: 'Name darf nicht leer sein.' });
  }
  if (!Number.isFinite(next.priceCents) || next.priceCents < 0 || !Number.isInteger(next.priceCents)) {
    throw new HttpError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'priceCents muss eine ganze Zahl >= 0 sein.',
    });
  }
  if (!next.currency) next.currency = 'EUR';

  const res = await pool.query(
    `
    UPDATE products
    SET
      sku = $2,
      name = $3,
      description = $4,
      price_cents = $5,
      currency = $6,
      is_active = $7,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id, sku, name, description, price_cents, currency, is_active,
      created_at, updated_at,
      stripe_product_id, stripe_price_id
    `,
    [Number(id), next.sku, next.name, next.description, next.priceCents, next.currency, next.isActive],
  );

  return mapProductRow(res.rows[0]);
}

/**
 * Admin/Stripe: persist mapping in DB (idempotent)
 * input: { stripeProductId, stripePriceId }
 * @returns {null | Product}
 */
export async function setStripeMappingById(id, mapping) {
  const stripeProductId =
    mapping?.stripeProductId !== undefined ? String(mapping.stripeProductId || '') : undefined;
  const stripePriceId =
    mapping?.stripePriceId !== undefined ? String(mapping.stripePriceId || '') : undefined;

  if (stripeProductId !== undefined && !stripeProductId) {
    throw new HttpError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'stripeProductId ist leer.',
    });
  }
  if (stripePriceId !== undefined && !stripePriceId) {
    throw new HttpError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'stripePriceId ist leer.',
    });
  }

  // Dynamisch nur setzen was vorhanden ist
  const sets = [];
  const values = [Number(id)];
  let idx = 2;

  if (stripeProductId !== undefined) {
    sets.push(`stripe_product_id = $${idx++}`);
    values.push(stripeProductId);
  }
  if (stripePriceId !== undefined) {
    sets.push(`stripe_price_id = $${idx++}`);
    values.push(stripePriceId);
  }

  // No-op: nichts zu setzen -> current zurück
  if (sets.length === 0) {
    return getProductByIdAdmin(id);
  }

  const res = await pool.query(
    `
    UPDATE products
    SET
      ${sets.join(', ')},
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id, sku, name, description, price_cents, currency, is_active,
      created_at, updated_at,
      stripe_product_id, stripe_price_id
    `,
    values,
  );

  if (res.rowCount === 0) return null;
  return mapProductRow(res.rows[0]);
}
