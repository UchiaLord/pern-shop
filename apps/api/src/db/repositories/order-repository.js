import { pool } from '../pool.js';

/**
 * Erzeugt eine Order aus Cart-Items.
 * Preise werden aus der products-Tabelle gelesen und in order_items eingefroren.
 *
 * @param {number} userId
 * @param {Array<{productId: number, quantity: number}>} cartItems
 * @returns {Promise<{order: any, items: any[]}>}
 */
export async function createOrderFromCart(userId, cartItems) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      const err = new Error('Warenkorb ist leer.');
      err.code = 'CART_EMPTY';
      throw err;
    }

    const productIds = cartItems.map((i) => i.productId);

    // Produkte laden (nur aktive)
    const productsRes = await client.query(
      `
      SELECT id, sku, name, price_cents, currency, is_active
      FROM products
      WHERE id = ANY($1::bigint[])
      `,
      [productIds],
    );

    const productsById = new Map(
      productsRes.rows.map((p) => [Number(p.id), p]),
    );

    // Validierung: alle existieren, aktiv, currency konsistent
    let currency = null;

    const normalizedItems = cartItems.map((ci) => {
      const p = productsById.get(ci.productId);
      if (!p) {
        const err = new Error(`Produkt ${ci.productId} existiert nicht.`);
        err.code = 'PRODUCT_NOT_FOUND';
        err.meta = { productId: ci.productId };
        throw err;
      }
      if (!p.is_active) {
        const err = new Error(`Produkt ${ci.productId} ist nicht aktiv.`);
        err.code = 'PRODUCT_INACTIVE';
        err.meta = { productId: ci.productId };
        throw err;
      }

      const pCurrency = p.currency ?? 'EUR';
      if (!currency) currency = pCurrency;
      if (currency !== pCurrency) {
        const err = new Error(
          'Währungen im Warenkorb dürfen nicht gemischt werden.',
        );
        err.code = 'MIXED_CURRENCY';
        throw err;
      }

      const unitPriceCents = Number(p.price_cents);
      const quantity = Number(ci.quantity);
      const lineTotalCents = unitPriceCents * quantity;

      return {
        productId: Number(p.id),
        sku: p.sku,
        name: p.name,
        currency: pCurrency,
        unitPriceCents,
        quantity,
        lineTotalCents,
      };
    });

    const subtotalCents = normalizedItems.reduce(
      (sum, i) => sum + i.lineTotalCents,
      0,
    );

    // Order anlegen
    const orderRes = await client.query(
      `
      INSERT INTO orders (user_id, status, currency, subtotal_cents)
      VALUES ($1, 'created', $2, $3)
      RETURNING id, user_id, status, currency, subtotal_cents, created_at
      `,
      [userId, currency ?? 'EUR', subtotalCents],
    );

    const orderRow = orderRes.rows[0];
    const orderId = Number(orderRow.id);

    // Items anlegen (Preis einfrieren)
    for (const item of normalizedItems) {
      await client.query(
        `
        INSERT INTO order_items (
          order_id, product_id, sku, name, unit_price_cents, currency, quantity, line_total_cents
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          orderId,
          item.productId,
          item.sku,
          item.name,
          item.unitPriceCents,
          item.currency,
          item.quantity,
          item.lineTotalCents,
        ],
      );
    }

    await client.query('COMMIT');

    return {
      order: {
        id: orderId,
        userId: Number(orderRow.user_id),
        status: orderRow.status,
        currency: orderRow.currency,
        subtotalCents: Number(orderRow.subtotal_cents),
        createdAt: orderRow.created_at,
      },
      items: normalizedItems,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Listet Orders eines Users.
 *
 * @param {number} userId
 * @returns {Promise<Array<{id:number, status:string, currency:string, subtotalCents:number, createdAt:any}>>}
 */
export async function listOrdersByUser(userId) {
  const res = await pool.query(
    `
    SELECT id, status, currency, subtotal_cents, created_at
    FROM orders
    WHERE user_id = $1
    ORDER BY id DESC
    `,
    [userId],
  );

  return res.rows.map((r) => ({
    id: Number(r.id),
    status: r.status,
    currency: r.currency,
    subtotalCents: Number(r.subtotal_cents),
    createdAt: r.created_at,
  }));
}

/**
 * Lädt Order-Details (inkl. Items) für einen User.
 *
 * @param {number} userId
 * @param {number} orderId
 */
export async function getOrderDetails(userId, orderId) {
  const orderRes = await pool.query(
    `
    SELECT id, user_id, status, currency, subtotal_cents, created_at
    FROM orders
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    [orderId, userId],
  );

  if (orderRes.rowCount === 0) return null;

  const o = orderRes.rows[0];

  const itemsRes = await pool.query(
    `
    SELECT product_id, sku, name, unit_price_cents, currency, quantity, line_total_cents
    FROM order_items
    WHERE order_id = $1
    ORDER BY product_id ASC
    `,
    [orderId],
  );

  return {
    order: {
      id: Number(o.id),
      userId: Number(o.user_id),
      status: o.status,
      currency: o.currency,
      subtotalCents: Number(o.subtotal_cents),
      createdAt: o.created_at,
    },
    items: itemsRes.rows.map((r) => ({
      productId: Number(r.product_id),
      sku: r.sku,
      name: r.name,
      unitPriceCents: Number(r.unit_price_cents),
      currency: r.currency,
      quantity: Number(r.quantity),
      lineTotalCents: Number(r.line_total_cents),
    })),
  };
}
