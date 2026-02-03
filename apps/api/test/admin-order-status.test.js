import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';

import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { createOrderFromCart } from '../src/db/repositories/order-repository.js';

const app = createApp();

describe('Admin Order Status Lifecycle', () => {
  beforeEach(async () => {
    await pool.query('DELETE FROM order_items');
    await pool.query('DELETE FROM orders');
    await pool.query("DELETE FROM products WHERE sku LIKE 'test-%'");
    await pool.query("DELETE FROM users WHERE email LIKE 'test+%@example.com'");
  });

  async function seedOrder() {
    const admin = request.agent(app);
    const adminReg = await admin.post('/auth/register').send({
      email: 'test+admin-status@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    expect(adminReg.status).toBe(201);

    const roleRes = await admin.post('/__test__/set-role').send({ role: 'admin' });
    expect(roleRes.status).toBe(200);

    const p = await admin.post('/products').send({
      sku: 'test-status-1',
      name: 'Status Produkt',
      priceCents: 500,
      currency: 'EUR',
    });
    expect(p.status).toBe(201);

    const productId = Number(p.body?.product?.id);

    const buyer = request.agent(app);
    const buyerReg = await buyer.post('/auth/register').send({
      email: 'test+buyer-status@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    expect(buyerReg.status).toBe(201);

    const buyerId = Number(buyerReg.body?.user?.id);

    const created = await createOrderFromCart(buyerId, [{ productId, quantity: 2 }]);
    expect(created.order.status).toBe('pending');

    return { admin, buyer, orderId: created.order.id };
  }

  it('PATCH /admin/orders/:id/status -> 401 ohne Login', async () => {
    const { orderId } = await seedOrder();
    const res = await request(app).patch(`/admin/orders/${orderId}/status`).send({ status: 'paid' });
    expect(res.status).toBe(401);
    expect(res.body?.error?.code).toBe('UNAUTHENTICATED');
  });

  it('PATCH /admin/orders/:id/status -> 403 als customer', async () => {
    const { orderId } = await seedOrder();

    const customer = request.agent(app);
    const reg = await customer.post('/auth/register').send({
      email: 'test+customer-status@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    expect(reg.status).toBe(201);

    const res = await customer.patch(`/admin/orders/${orderId}/status`).send({ status: 'paid' });
    expect(res.status).toBe(403);
    expect(res.body?.error?.code).toBe('FORBIDDEN');
  });

  it('Lifecycle: pending -> paid -> shipped -> completed', async () => {
    const { admin, orderId } = await seedOrder();

    const paid = await admin.patch(`/admin/orders/${orderId}/status`).send({ status: 'paid' });
    expect(paid.status).toBe(200);
    expect(paid.body.order.status).toBe('paid');

    const shipped = await admin
      .patch(`/admin/orders/${orderId}/status`)
      .send({ status: 'shipped' });
    expect(shipped.status).toBe(200);
    expect(shipped.body.order.status).toBe('shipped');

    const completed = await admin
      .patch(`/admin/orders/${orderId}/status`)
      .send({ status: 'completed' });
    expect(completed.status).toBe(200);
    expect(completed.body.order.status).toBe('completed');
  });

  it('Invalid transition: pending -> shipped => 400 INVALID_STATUS_TRANSITION', async () => {
    const { admin, orderId } = await seedOrder();

    const res = await admin.patch(`/admin/orders/${orderId}/status`).send({ status: 'shipped' });
    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('Cancel: pending -> cancelled, danach keine weiteren Transitions', async () => {
    const { admin, orderId } = await seedOrder();

    const cancelled = await admin
      .patch(`/admin/orders/${orderId}/status`)
      .send({ status: 'cancelled' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.order.status).toBe('cancelled');

    const after = await admin.patch(`/admin/orders/${orderId}/status`).send({ status: 'paid' });
    expect(after.status).toBe(400);
    expect(after.body?.error?.code).toBe('INVALID_STATUS_TRANSITION');
  });
});