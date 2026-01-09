import { pool } from '../pool.js';

function mapRow(row) {
  return {
    id: Number(row.id),
    sku: row.sku,
    name: row.name,
    description: row.description,
    priceCents: Number(row.price_cents),
    currency: row.currency,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createProduct({ sku, name, description, priceCents, currency = 'EUR', isActive = true }) {
  const { rows } = await pool.query(
    `
    INSERT INTO products (sku, name, description, price_cents, currency, is_active)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [sku, name, description ?? null, priceCents, currency, isActive],
  );

  return mapRow(rows[0]);
}

export async function listActiveProducts() {
  const { rows } = await pool.query(
    `
    SELECT *
    FROM products
    WHERE is_active = true
    ORDER BY id ASC
    `,
  );
  return rows.map(mapRow);
}

export async function updateProductById(id, patch) {
  // Whitelist + dynamisches SET (nur erlaubte Felder)
  const sets = [];
  const values = [];
  let i = 1;

  if (patch.sku !== undefined) {
    sets.push(`sku = $${i++}`);
    values.push(patch.sku);
  }
  if (patch.name !== undefined) {
    sets.push(`name = $${i++}`);
    values.push(patch.name);
  }
  if (patch.description !== undefined) {
    sets.push(`description = $${i++}`);
    values.push(patch.description);
  }
  if (patch.priceCents !== undefined) {
    sets.push(`price_cents = $${i++}`);
    values.push(patch.priceCents);
  }
  if (patch.currency !== undefined) {
    sets.push(`currency = $${i++}`);
    values.push(patch.currency);
  }
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${i++}`);
    values.push(patch.isActive);
  }

  if (sets.length === 0) {
    // Kein Patch-Feld -> dann "aktuelles Produkt" liefern (oder 400, je nach gewünschtem Contract)
    const { rows } = await pool.query(`SELECT * FROM products WHERE id = $1`, [id]);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  values.push(id);

  const { rows } = await pool.query(
    `
    UPDATE products
    SET ${sets.join(', ')}
    WHERE id = $${i}
    RETURNING *
    `,
    values,
  );

  return rows[0] ? mapRow(rows[0]) : null;
}
