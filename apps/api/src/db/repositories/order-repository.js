import { pool } from '../pool.js';
import { HttpError } from '../../errors/http-error.js';

const ALLOWED_TRANSITIONS = {
  pending: new Set(['paid', 'cancelled']),
  paid: new Set(['shipped', 'cancelled']),
  shipped: new Set(['completed']),
  completed: new Set([]),
  cancelled: new Set([]),
};

function assertTransition(current, next) {
  if (current === next) return; // idempotent OK
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed || !allowed.has(next)) {
    throw new HttpError({
      status: 400,
      code: 'INVALID_STATUS_TRANSITION',
      message: `Ungültiger Statuswechsel: ${current} -> ${next}`,
    });
  }
}

/**
 * Erstellt Order aus Cart Items und friert Preise ein.
 * items: [{ productId, quantity }]
 */
export async function createOrderFromCart(userId, items) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpError({
        status: 400,
        code: 'CART_EMPTY',
        message: 'Warenkorb ist leer.',
      });
    }

    const ids = items.map((i) => Number(i.productId));
    const productsRes = await client.query(
      `
      SELECT id, sku, name, price_cents, currency, is_active
      FROM products
      WHERE id = ANY($1::bigint[])
      `,
      [ids],
    );

    const byId = new Map(productsRes.rows.map((p) => [Number(p.id), p]));

    let currency = null;
    let subtotalCents = 0;

    for (const it of items) {
      const p = byId.get(Number(it.productId));
      if (!p) {
        throw new HttpError({
          status: 400,
          code: 'PRODUCT_NOT_FOUND',
          message: 'Ein Produkt im Warenkorb existiert nicht.',
        });
      }
      if (!p.is_active) {
        throw new HttpError({
          status: 400,
          code: 'PRODUCT_INACTIVE',
          message: 'Ein Produkt im Warenkorb ist deaktiviert.',
        });
      }

      const pCur = p.currency ?? 'EUR';
      if (!currency) currency = pCur;
      if (currency !== pCur) {
        throw new HttpError({
          status: 400,
          code: 'MIXED_CURRENCY',
          message: 'Mixed Currency ist nicht erlaubt.',
        });
      }

      const qty = Number(it.quantity);
      const unit = Number(p.price_cents);
      subtotalCents += unit * qty;
    }

    const orderRes = await client.query(
      `
      INSERT INTO orders (user_id, currency, subtotal_cents, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING
        id, user_id, currency, subtotal_cents, status,
        created_at, updated_at,
        paid_at, shipped_at, completed_at
      `,
      [userId, currency ?? 'EUR', subtotalCents],
    );

    const order = orderRes.rows[0];

    const createdItems = [];
    for (const it of items) {
      const p = byId.get(Number(it.productId));
      const qty = Number(it.quantity);
      const unit = Number(p.price_cents);
      const lineTotal = unit * qty;

      const itemRes = await client.query(
        `
        INSERT INTO order_items (
          order_id, product_id, sku, name, unit_price_cents, currency, quantity, line_total_cents
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING product_id, sku, name, unit_price_cents, currency, quantity, line_total_cents
        `,
        [
          Number(order.id),
          Number(p.id),
          p.sku,
          p.name,
          unit,
          p.currency ?? 'EUR',
          qty,
          lineTotal,
        ],
      );

      createdItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');

    return {
      order: {
        id: Number(order.id),
        userId: Number(order.user_id),
        currency: order.currency,
        subtotalCents: Number(order.subtotal_cents),
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        paidAt: order.paid_at,
        shippedAt: order.shipped_at,
        completedAt: order.completed_at,
      },
      items: createdItems.map((i) => ({
        productId: Number(i.product_id),
        sku: i.sku,
        name: i.name,
        unitPriceCents: Number(i.unit_price_cents),
        currency: i.currency,
        quantity: Number(i.quantity),
        lineTotalCents: Number(i.line_total_cents),
      })),
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * User: Liste der eigenen Orders
 */
export async function listOrdersByUser(userId) {
  const res = await pool.query(
    `
    SELECT id, status, currency, subtotal_cents, created_at, updated_at, paid_at, shipped_at, completed_at
    FROM orders
    WHERE user_id = $1
    ORDER BY id DESC
    `,
    [userId],
  );

  return res.rows.map((o) => ({
    id: Number(o.id),
    status: o.status,
    currency: o.currency,
    subtotalCents: Number(o.subtotal_cents),
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    paidAt: o.paid_at,
    shippedAt: o.shipped_at,
    completedAt: o.completed_at,
  }));
}

/**
 * User: Details einer Order (nur wenn owner)
 * @returns {null | {order: {...}, items: [...]}}
 */
export async function getOrderDetails(userId, orderId) {
  const orderRes = await pool.query(
    `
    SELECT id, user_id, status, currency, subtotal_cents, created_at, updated_at, paid_at, shipped_at, completed_at
    FROM orders
    WHERE id = $1 AND user_id = $2
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
      updatedAt: o.updated_at,
      paidAt: o.paid_at,
      shippedAt: o.shipped_at,
      completedAt: o.completed_at,
    },
    items: itemsRes.rows.map((i) => ({
      productId: Number(i.product_id),
      sku: i.sku,
      name: i.name,
      unitPriceCents: Number(i.unit_price_cents),
      currency: i.currency,
      quantity: Number(i.quantity),
      lineTotalCents: Number(i.line_total_cents),
    })),
  };
}

/**
 * Admin: Liste aller Orders (read-only)
 */
export async function listAllOrdersAdmin() {
  const res = await pool.query(
    `
    SELECT id, user_id, status, currency, subtotal_cents, created_at, updated_at, paid_at, shipped_at, completed_at
    FROM orders
    ORDER BY id DESC
    `,
  );

  return res.rows.map((o) => ({
    id: Number(o.id),
    userId: Number(o.user_id),
    status: o.status,
    currency: o.currency,
    subtotalCents: Number(o.subtotal_cents),
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    paidAt: o.paid_at,
    shippedAt: o.shipped_at,
    completedAt: o.completed_at,
  }));
}

/**
 * Admin: Order Details inkl Items
 */
export async function getOrderDetailsAdmin(orderId) {
  const orderRes = await pool.query(
    `
    SELECT id, user_id, status, currency, subtotal_cents, created_at, updated_at, paid_at, shipped_at, completed_at
    FROM orders
    WHERE id = $1
    `,
    [orderId],
  );

  if (orderRes.rowCount === 0) {
    throw new HttpError({
      status: 404,
      code: 'ORDER_NOT_FOUND',
      message: 'Order existiert nicht.',
    });
  }

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
      updatedAt: o.updated_at,
      paidAt: o.paid_at,
      shippedAt: o.shipped_at,
      completedAt: o.completed_at,
    },
    items: itemsRes.rows.map((i) => ({
      productId: Number(i.product_id),
      sku: i.sku,
      name: i.name,
      unitPriceCents: Number(i.unit_price_cents),
      currency: i.currency,
      quantity: Number(i.quantity),
      lineTotalCents: Number(i.line_total_cents),
    })),
  };
}

/**
 * Admin: Status Update (Transition-Guards) + Status-Timestamps
 */
export async function updateOrderStatusAdmin(orderId, nextStatus) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const curRes = await client.query(
      `
      SELECT id, status, currency, subtotal_cents, created_at, updated_at, paid_at, shipped_at, completed_at
      FROM orders
      WHERE id = $1
      FOR UPDATE
      `,
      [orderId],
    );

    if (curRes.rowCount === 0) {
      throw new HttpError({
        status: 404,
        code: 'ORDER_NOT_FOUND',
        message: 'Order existiert nicht.',
      });
    }

    const cur = curRes.rows[0];
    const currentStatus = cur.status;

    assertTransition(currentStatus, nextStatus);

    if (currentStatus === nextStatus) {
      await client.query('COMMIT');
      return {
        id: Number(cur.id),
        status: cur.status,
        currency: cur.currency,
        subtotalCents: Number(cur.subtotal_cents),
        createdAt: cur.created_at,
        updatedAt: cur.updated_at,
        paidAt: cur.paid_at,
        shippedAt: cur.shipped_at,
        completedAt: cur.completed_at,
      };
    }

    const updRes = await client.query(
      `
      UPDATE orders
      SET
        status = $2,
        updated_at = NOW(),
        paid_at = CASE
          WHEN $2 = 'paid' AND paid_at IS NULL THEN NOW()
          ELSE paid_at
        END,
        shipped_at = CASE
          WHEN $2 = 'shipped' AND shipped_at IS NULL THEN NOW()
          ELSE shipped_at
        END,
        completed_at = CASE
          WHEN $2 = 'completed' AND completed_at IS NULL THEN NOW()
          ELSE completed_at
        END
      WHERE id = $1
      RETURNING id, user_id, status, currency, subtotal_cents, created_at, updated_at, paid_at, shipped_at, completed_at
      `,
      [orderId, nextStatus],
    );

    await client.query('COMMIT');

    const u = updRes.rows[0];
    return {
      id: Number(u.id),
      userId: Number(u.user_id),
      status: u.status,
      currency: u.currency,
      subtotalCents: Number(u.subtotal_cents),
      createdAt: u.created_at,
      updatedAt: u.updated_at,
      paidAt: u.paid_at,
      shippedAt: u.shipped_at,
      completedAt: u.completed_at,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}