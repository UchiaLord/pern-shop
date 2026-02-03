import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';
import { createOrderFromCart } from '../src/db/repositories/order-repository.js';

const app = createApp();

describe('Admin Orders (read-only)', () => {
  async function seedOrder() {
    const admin = request.agent(app);
    const adminReg = await admin.post('/auth/register').send({
      email: 'test+admin-adminorders@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    expect(adminReg.status).toBe(201);

    const roleRes = await admin.post('/__test__/set-role').send({ role: 'admin' });
    expect(roleRes.status).toBe(200);

    const p = await admin.post('/products').send({
      sku: 'test-adminorders-1',
      name: 'AdminOrders Produkt',
      priceCents: 500,
      currency: 'EUR',
    });
    expect(p.status).toBe(201);

    const productId = Number(p.body?.product?.id);
    expect(Number.isInteger(productId)).toBe(true);

    const buyer = request.agent(app);
    const buyerReg = await buyer.post('/auth/register').send({
      email: 'test+buyer-adminorders@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    expect(buyerReg.status).toBe(201);

    const buyerId = Number(buyerReg.body?.user?.id);
    expect(Number.isInteger(buyerId)).toBe(true);

    const created = await createOrderFromCart(buyerId, [{ productId, quantity: 2 }]);
    expect(created?.order?.id).toBeTruthy();
    expect(created.order.status).toBe('pending');

    return { admin, buyer, orderId: created.order.id };
  }

  it('GET /admin/orders -> 401 ohne Login', async () => {
    const res = await request(app).get('/admin/orders');
    expect(res.status).toBe(401);
    expect(res.body?.error?.code).toBe('UNAUTHENTICATED');
  });

  it('GET /admin/orders -> 403 als customer', async () => {
    const customer = request.agent(app);
    const reg = await customer.post('/auth/register').send({
      email: 'test+customer-adminorders@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    expect(reg.status).toBe(201);

    const res = await customer.get('/admin/orders');
    expect(res.status).toBe(403);
    expect(res.body?.error?.code).toBe('FORBIDDEN');
  });

  it('GET /admin/orders -> 200 als admin + enthält Orders', async () => {
    const { admin, orderId } = await seedOrder();

    const res = await admin.get('/admin/orders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBeGreaterThanOrEqual(1);

    const found = res.body.orders.find((o) => o.id === orderId);
    expect(found).toBeTruthy();
    expect(found.status).toBe('pending');
  });

  it('GET /admin/orders/:id -> 401 ohne Login', async () => {
    const { orderId } = await seedOrder();

    const res = await request(app).get(`/admin/orders/${orderId}`);
    expect(res.status).toBe(401);
    expect(res.body?.error?.code).toBe('UNAUTHENTICATED');
  });

  it('GET /admin/orders/:id -> 403 als customer', async () => {
    const { orderId } = await seedOrder();

    const customer = request.agent(app);
    const reg = await customer.post('/auth/register').send({
      email: 'test+customer2-adminorders@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    expect(reg.status).toBe(201);

    const res = await customer.get(`/admin/orders/${orderId}`);
    expect(res.status).toBe(403);
    expect(res.body?.error?.code).toBe('FORBIDDEN');
  });

  it('GET /admin/orders/:id -> 200 als admin + Details inkl. Items + Status', async () => {
    const { admin, orderId } = await seedOrder();

    const res = await admin.get(`/admin/orders/${orderId}`);
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(orderId);
    expect(res.body.order.status).toBe('pending');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].lineTotalCents).toBe(1000);
  });

  it('GET /admin/orders/:id -> 404 wenn Order nicht existiert', async () => {
    const { admin } = await seedOrder();

    const res = await admin.get('/admin/orders/999999');
    expect(res.status).toBe(404);
  });
});