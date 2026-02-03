import { pool } from '../pool.js';
import { HttpError } from '../../errors/http-error.js';

/**
 * Erzeugt eine Order aus Cart-Items.
 * Preise werden aus der products-Tabelle gelesen und in order_items eingefroren.
 *
 * Status Lifecycle (Day 20):
 * pending | paid | canceled | failed
 * Neue Orders starten immer als "pending".
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
      throw new HttpError({
        status: 400,
        code: 'CART_EMPTY',
        message: 'Warenkorb ist leer.'
      });
    }

    const normalizedCart = cartItems.map((i) => ({
      productId: Number(i.productId),
      quantity: Number(i.quantity)
    }));

    for (const item of normalizedCart) {
      if (!Number.isInteger(item.productId) || item.productId <= 0) {
        throw new HttpError({
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Ungültige Cart-Items.',
          details: { productId: 'productId muss eine positive ganze Zahl sein.' }
        });
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new HttpError({
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Ungültige Cart-Items.',
          details: { quantity: 'quantity muss eine positive ganze Zahl sein.' }
        });
      }
    }

    const productIds = normalizedCart.map((i) => i.productId);

    const productsRes = await client.query(
      `
      SELECT id, sku, name, price_cents, currency, is_active
      FROM products
      WHERE id = ANY($1::bigint[])
      `,
      [productIds]
    );

    const productsById = new Map(productsRes.rows.map((p) => [Number(p.id), p]));

    let currency = null;

    const normalizedItems = normalizedCart.map((ci) => {
      const p = productsById.get(ci.productId);

      if (!p) {
        throw new HttpError({
          status: 400,
          code: 'PRODUCT_NOT_FOUND',
          message: 'Ein Produkt im Warenkorb existiert nicht.',
          details: { productId: ci.productId }
        });
      }

      if (!p.is_active) {
        throw new HttpError({
          status: 400,
          code: 'PRODUCT_INACTIVE',
          message: 'Ein Produkt im Warenkorb ist nicht aktiv.',
          details: { productId: ci.productId }
        });
      }

      const pCurrency = p.currency ?? 'EUR';
      if (!currency) currency = pCurrency;

      if (currency !== pCurrency) {
        throw new HttpError({
          status: 400,
          code: 'MIXED_CURRENCY',
          message: 'Währungen im Warenkorb dürfen nicht gemischt werden.'
        });
      }

      const unitPriceCents = Number(p.price_cents);
      const quantity = ci.quantity;
      const lineTotalCents = unitPriceCents * quantity;

      return {
        productId: Number(p.id),
        sku: p.sku,
        name: p.name,
        currency: pCurrency,
        unitPriceCents,
        quantity,
        lineTotalCents
      };
    });

    const subtotalCents = normalizedItems.reduce((sum, i) => sum + i.lineTotalCents, 0);

    // Day 20 lifecycle: new orders start as "pending"
    const orderRes = await client.query(
      `
      INSERT INTO orders (user_id, status, currency, subtotal_cents)
      VALUES ($1, 'pending', $2, $3)
      RETURNING id, user_id, status, currency, subtotal_cents, created_at
      `,
      [userId, currency ?? 'EUR', subtotalCents]
    );

    const orderRow = orderRes.rows[0];
    const orderId = Number(orderRow.id);

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
          item.lineTotalCents
        ]
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
        createdAt: orderRow.created_at
      },
      items: normalizedItems
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
 */
export async function listOrdersByUser(userId) {
  const res = await pool.query(
    `
    SELECT id, status, currency, subtotal_cents, created_at
    FROM orders
    WHERE user_id = $1
    ORDER BY id DESC
    `,
    [userId]
  );

  return res.rows.map((r) => ({
    id: Number(r.id),
    status: r.status,
    currency: r.currency,
    subtotalCents: Number(r.subtotal_cents),
    createdAt: r.created_at
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
    [orderId, userId]
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
    [orderId]
  );

  return {
    order: {
      id: Number(o.id),
      userId: Number(o.user_id),
      status: o.status,
      currency: o.currency,
      subtotalCents: Number(o.subtotal_cents),
      createdAt: o.created_at
    },
    items: itemsRes.rows.map((r) => ({
      productId: Number(r.product_id),
      sku: r.sku,
      name: r.name,
      unitPriceCents: Number(r.unit_price_cents),
      currency: r.currency,
      quantity: Number(r.quantity),
      lineTotalCents: Number(r.line_total_cents)
    }))
  };
}