// apps/api/src/db/repositories/order-repository.js
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

async function createOrderStatusEvent(client, { orderId, fromStatus, toStatus, reason, source, metadata }) {
  await client.query(
    `
    INSERT INTO order_status_events (order_id, from_status, to_status, reason, source, metadata)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      Number(orderId),
      fromStatus ?? null,
      String(toStatus),
      reason ?? null,
      String(source),
      JSON.stringify(metadata ?? {}),
    ],
  );
}

function mapEventRow(r) {
  return {
    id: Number(r.id),
    orderId: Number(r.order_id),
    fromStatus: r.from_status ?? null,
    toStatus: r.to_status,
    reason: r.reason ?? null,
    source: r.source,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
  };
}

/**
 * Day 31 helper:
 * Allow payments/create-intent to reuse a previously created pending order
 * for the same user, if it already has a PaymentIntent attached.
 */
export async function getOrderForPaymentReuseByUser(userId, orderId) {
  const res = await pool.query(
    `
    SELECT id, user_id, status, currency, subtotal_cents, payment_intent_id,
           created_at, updated_at, paid_at, shipped_at, completed_at
    FROM orders
    WHERE id = $1 AND user_id = $2
    `,
    [Number(orderId), Number(userId)],
  );

  if (res.rowCount === 0) return null;

  const o = res.rows[0];
  return {
    id: Number(o.id),
    userId: Number(o.user_id),
    status: o.status,
    currency: o.currency,
    subtotalCents: Number(o.subtotal_cents),
    paymentIntentId: o.payment_intent_id ?? null,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    paidAt: o.paid_at,
    shippedAt: o.shipped_at,
    completedAt: o.completed_at,
  };
}

/**
 * Day 32:
 * Admin timeline (order exists check).
 */
export async function listOrderStatusEventsAdmin(orderId) {
  const exists = await pool.query(`SELECT id FROM orders WHERE id = $1`, [Number(orderId)]);
  if (exists.rowCount === 0) {
    throw new HttpError({
      status: 404,
      code: 'ORDER_NOT_FOUND',
      message: 'Order existiert nicht.',
    });
  }

  const res = await pool.query(
    `
    SELECT id, order_id, from_status, to_status, reason, source, metadata, created_at
    FROM order_status_events
    WHERE order_id = $1
    ORDER BY created_at ASC, id ASC
    `,
    [Number(orderId)],
  );

  return res.rows.map(mapEventRow);
}

/**
 * Day 32:
 * User timeline (returns null if not owner or not found).
 */
export async function listOrderStatusEventsForUser(userId, orderId) {
  const owns = await pool.query(
    `SELECT id FROM orders WHERE id = $1 AND user_id = $2`,
    [Number(orderId), Number(userId)],
  );
  if (owns.rowCount === 0) return null;

  const res = await pool.query(
    `
    SELECT id, order_id, from_status, to_status, reason, source, metadata, created_at
    FROM order_status_events
    WHERE order_id = $1
    ORDER BY created_at ASC, id ASC
    `,
    [Number(orderId)],
  );

  return res.rows.map(mapEventRow);
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
        payment_intent_id,
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

    // Day 32: initial status event (system)
    await createOrderStatusEvent(client, {
      orderId: Number(order.id),
      fromStatus: null,
      toStatus: 'pending',
      reason: 'checkout',
      source: 'system',
      metadata: {
        itemsCount: items.length,
        subtotalCents,
        currency: currency ?? 'EUR',
      },
    });

    await client.query('COMMIT');

    return {
      order: {
        id: Number(order.id),
        userId: Number(order.user_id),
        currency: order.currency,
        subtotalCents: Number(order.subtotal_cents),
        status: order.status,
        paymentIntentId: order.payment_intent_id ?? null,
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
 * Attach a PaymentIntent to an order (idempotent).
 * - If order already has same payment_intent_id -> OK
 * - If order already has different payment_intent_id -> conflict
 * - If payment_intent_id is already used by another order -> conflict (unique index)
 */
export async function attachPaymentIntentToOrder(orderId, paymentIntentId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const curRes = await client.query(
      `
      SELECT id, status, payment_intent_id
      FROM orders
      WHERE id = $1
      FOR UPDATE
      `,
      [Number(orderId)],
    );

    if (curRes.rowCount === 0) {
      throw new HttpError({
        status: 404,
        code: 'ORDER_NOT_FOUND',
        message: 'Order existiert nicht.',
      });
    }

    const cur = curRes.rows[0];
    const existing = cur.payment_intent_id ?? null;

    if (existing && existing !== paymentIntentId) {
      throw new HttpError({
        status: 409,
        code: 'PAYMENT_INTENT_CONFLICT',
        message: 'Order hat bereits eine andere PaymentIntent ID.',
      });
    }

    if (!existing) {
      try {
        await client.query(
          `
          UPDATE orders
          SET
            payment_intent_id = $2,
            updated_at = NOW()
          WHERE id = $1
          `,
          [Number(orderId), String(paymentIntentId)],
        );
      } catch (e) {
        throw new HttpError({
          status: 409,
          code: 'PAYMENT_INTENT_CONFLICT',
          message: 'PaymentIntent ist bereits einer anderen Order zugeordnet.',
          details: { reason: e?.message ?? String(e) },
        });
      }
    }

    await client.query('COMMIT');
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
    SELECT id, status, currency, subtotal_cents, payment_intent_id,
           created_at, updated_at, paid_at, shipped_at, completed_at
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
    paymentIntentId: o.payment_intent_id ?? null,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    paidAt: o.paid_at,
    shippedAt: o.shipped_at,
    completedAt: o.completed_at,
  }));
}

/**
 * User: Details einer Order (nur wenn owner)
 * @returns {null | {order: {...}, items: [...] } }
 */
export async function getOrderDetails(userId, orderId) {
  const orderRes = await pool.query(
    `
    SELECT id, user_id, status, currency, subtotal_cents, payment_intent_id,
           created_at, updated_at, paid_at, shipped_at, completed_at
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
      paymentIntentId: o.payment_intent_id ?? null,
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
    SELECT id, user_id, status, currency, subtotal_cents, payment_intent_id,
           created_at, updated_at, paid_at, shipped_at, completed_at
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
    paymentIntentId: o.payment_intent_id ?? null,
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
    SELECT id, user_id, status, currency, subtotal_cents, payment_intent_id,
           created_at, updated_at, paid_at, shipped_at, completed_at
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
      paymentIntentId: o.payment_intent_id ?? null,
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
      lineTotalCents: Number(i.quantity) * Number(i.unit_price_cents),
      lineTotalCentsRaw: Number(i.line_total_cents),
    })),
  };
}

/**
 * Admin: Status Update (Transition-Guards) + Status-Timestamps
 * Day 32: writes an order_status_events row on successful transition.
 */
export async function updateOrderStatusAdmin(orderId, nextStatus) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const curRes = await client.query(
      `
      SELECT id, user_id, status, currency, subtotal_cents, payment_intent_id,
             created_at, updated_at, paid_at, shipped_at, completed_at
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
        userId: Number(cur.user_id),
        status: cur.status,
        currency: cur.currency,
        subtotalCents: Number(cur.subtotal_cents),
        paymentIntentId: cur.payment_intent_id ?? null,
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
      RETURNING id, user_id, status, currency, subtotal_cents, payment_intent_id,
                created_at, updated_at, paid_at, shipped_at, completed_at
      `,
      [orderId, nextStatus],
    );

    await createOrderStatusEvent(client, {
      orderId: Number(orderId),
      fromStatus: currentStatus,
      toStatus: nextStatus,
      reason: null,
      source: 'admin',
      metadata: {},
    });

    await client.query('COMMIT');

    const u = updRes.rows[0];
    return {
      id: Number(u.id),
      userId: Number(u.user_id),
      status: u.status,
      currency: u.currency,
      subtotalCents: Number(u.subtotal_cents),
      paymentIntentId: u.payment_intent_id ?? null,
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

/**
 * Stripe webhook helper: mark order as paid (idempotent) and bind paymentIntentId.
 * Day 32: emits status event only when a real transition happened.
 */
export async function markOrderPaidByWebhook(orderId, paymentIntentId) {
  const pi = String(paymentIntentId ?? '').trim();
  if (!pi) {
    throw new HttpError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'paymentIntentId fehlt.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const curRes = await client.query(
      `
      SELECT id, status, paid_at, payment_intent_id
      FROM orders
      WHERE id = $1
      FOR UPDATE
      `,
      [Number(orderId)],
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
    const existingPi = cur.payment_intent_id ?? null;

    if (existingPi && existingPi !== pi) {
      throw new HttpError({
        status: 409,
        code: 'PAYMENT_INTENT_CONFLICT',
        message: 'Order hat bereits eine andere PaymentIntent ID.',
      });
    }

    if (currentStatus === 'paid' || currentStatus === 'shipped' || currentStatus === 'completed') {
      if (!existingPi) {
        await client.query(
          `
          UPDATE orders
          SET
            payment_intent_id = $2,
            updated_at = NOW()
          WHERE id = $1
          `,
          [Number(orderId), pi],
        );
      }
      await client.query('COMMIT');
      return;
    }

    if (currentStatus === 'cancelled') {
      await client.query('COMMIT');
      return;
    }

    assertTransition(currentStatus, 'paid');

    await client.query(
      `
      UPDATE orders
      SET
        status = 'paid',
        payment_intent_id = COALESCE(payment_intent_id, $2),
        updated_at = NOW(),
        paid_at = CASE
          WHEN paid_at IS NULL THEN NOW()
          ELSE paid_at
        END
      WHERE id = $1
      `,
      [Number(orderId), pi],
    );

    await createOrderStatusEvent(client, {
      orderId: Number(orderId),
      fromStatus: currentStatus,
      toStatus: 'paid',
      reason: null,
      source: 'webhook',
      metadata: { paymentIntentId: pi, sourceEvent: 'payment_intent.succeeded' },
    });

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Day 31: Stripe webhook helper for failures/cancellations.
 * Day 32: emits status event only when transition occurs.
 */
export async function markOrderCancelledByWebhook(orderId, paymentIntentId, meta = {}) {
  const pi = String(paymentIntentId ?? '').trim();
  if (!pi) {
    throw new HttpError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'paymentIntentId fehlt.',
    });
  }

  console.log(
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        source: 'order-repository',
        action: 'markOrderCancelledByWebhook',
        orderId: Number(orderId),
        paymentIntentId: pi,
        meta,
      },
      null,
      0,
    ),
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const curRes = await client.query(
      `
      SELECT id, status, payment_intent_id
      FROM orders
      WHERE id = $1
      FOR UPDATE
      `,
      [Number(orderId)],
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
    const existingPi = cur.payment_intent_id ?? null;

    if (existingPi && existingPi !== pi) {
      throw new HttpError({
        status: 409,
        code: 'PAYMENT_INTENT_CONFLICT',
        message: 'Order hat bereits eine andere PaymentIntent ID.',
      });
    }

    if (currentStatus === 'cancelled') {
      if (!existingPi) {
        await client.query(
          `
          UPDATE orders
          SET
            payment_intent_id = $2,
            updated_at = NOW()
          WHERE id = $1
          `,
          [Number(orderId), pi],
        );
      }
      await client.query('COMMIT');
      return;
    }

    if (currentStatus === 'completed') {
      await client.query('COMMIT');
      return;
    }

    assertTransition(currentStatus, 'cancelled');

    await client.query(
      `
      UPDATE orders
      SET
        status = 'cancelled',
        payment_intent_id = COALESCE(payment_intent_id, $2),
        updated_at = NOW()
      WHERE id = $1
      `,
      [Number(orderId), pi],
    );

    await createOrderStatusEvent(client, {
      orderId: Number(orderId),
      fromStatus: currentStatus,
      toStatus: 'cancelled',
      reason: meta?.reason ?? null,
      source: 'webhook',
      metadata: { paymentIntentId: pi, ...meta },
    });

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
