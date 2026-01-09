import { pool } from '../pool.js';

/**
 * Legt ein Produkt an.
 *
 * @param {{sku: string, name: string, description?: string|null, priceCents: number, currency?: string}} input
 * @returns {Promise<{id: number, sku: string, name: string, description: string|null, priceCents: number, currency: string, isActive: boolean}>}
 */
export async function createProduct(input) {
  const result = await pool.query(
    `
    INSERT INTO products (sku, name, description, price_cents, currency)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, sku, name, description, price_cents, currency, is_active
    `,
    [
      input.sku,
      input.name,
      input.description ?? null,
      input.priceCents,
      input.currency ?? 'EUR',
    ],
  );

  const row = result.rows[0];
  return mapProductRow(row);
}

/**
 * Listet aktive Produkte (Default).
 *
 * @returns {Promise<Array<{id: number, sku: string, name: string, description: string|null, priceCents: number, currency: string, isActive: boolean}>>}
 */
export async function listActiveProducts() {
  const result = await pool.query(
    `
    SELECT id, sku, name, description, price_cents, currency, is_active
    FROM products
    WHERE is_active = true
    ORDER BY id DESC
    `,
  );

  return result.rows.map(mapProductRow);
}

/**
 * Findet ein aktives Produkt per ID.
 *
 * @param {number} id
 * @returns {Promise<null|{id: number, sku: string, name: string, description: string|null, priceCents: number, currency: string, isActive: boolean}>}
 */
export async function findActiveProductById(id) {
  const result = await pool.query(
    `
    SELECT id, sku, name, description, price_cents, currency, is_active
    FROM products
    WHERE id = $1 AND is_active = true
    LIMIT 1
    `,
    [id],
  );

  if (result.rowCount === 0) return null;
  return mapProductRow(result.rows[0]);
}

/**
 * Aktualisiert ein Produkt (Admin).
 *
 * @param {number} id
 * @param {{sku?: string, name?: string, description?: string|null, priceCents?: number, currency?: string, isActive?: boolean}} patch
 * @returns {Promise<null|{id: number, sku: string, name: string, description: string|null, priceCents: number, currency: string, isActive: boolean}>}
 */
export async function updateProduct(id, patch) {
  const result = await pool.query(
    `
    UPDATE products
    SET
      sku = COALESCE($2, sku),
      name = COALESCE($3, name),
      description = COALESCE($4, description),
      price_cents = COALESCE($5, price_cents),
      currency = COALESCE($6, currency),
      is_active = COALESCE($7, is_active)
    WHERE id = $1
    RETURNING id, sku, name, description, price_cents, currency, is_active
    `,
    [
      id,
      patch.sku ?? null,
      patch.name ?? null,
      patch.description ?? null,
      typeof patch.priceCents === 'number' ? patch.priceCents : null,
      patch.currency ?? null,
      typeof patch.isActive === 'boolean' ? patch.isActive : null,
    ],
  );

  if (result.rowCount === 0) return null;
  return mapProductRow(result.rows[0]);
}

function mapProductRow(row) {
  return {
    id: Number(row.id),
    sku: row.sku,
    name: row.name,
    description: row.description,
    priceCents: Number(row.price_cents),
    currency: row.currency,
    isActive: row.is_active,
  };
}
