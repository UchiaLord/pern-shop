// apps/api/test/order-timeline.test.js
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('stripe', () => {
  class StripeMock {
    constructor() {
      this.paymentIntents = {
        create: vi.fn(async () => ({ id: 'pi_test_x', client_secret: 'cs_test_x' })),
        retrieve: vi.fn(async () => ({ id: 'pi_test_x', client_secret: 'cs_test_x' })),
      };
      this.webhooks = {
        constructEvent: vi.fn(() => {
          const ev = globalThis.__STRIPE_EVENT__;
          if (!ev) throw new Error('No __STRIPE_EVENT__ set');
          return ev;
        }),
      };
    }
  }
  return { default: StripeMock };
});

async function register(agent, email) {
  const res = await agent.post('/auth/register').send({
    email,
    password: 'SehrSicheresPasswort123!',
  });
  expect([200, 201]).toContain(res.status);
}

describe('Order Timeline (Day 32)', () => {
  let createApp;
  let app;

  const envBackup = {};

  beforeEach(async () => {
    envBackup.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    envBackup.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';

    ({ createApp } = await import('../src/app.js'));
    app = createApp();

    globalThis.__STRIPE_EVENT__ = null;
  });

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = envBackup.STRIPE_SECRET_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = envBackup.STRIPE_WEBHOOK_SECRET;
    globalThis.__STRIPE_EVENT__ = null;
  });

  it('writes timeline events for checkout + admin transitions and exposes via admin endpoint', async () => {
    const admin = request.agent(app);
    await register(admin, 'test+timeline-admin@example.com');
    const role = await admin.post('/__test__/set-role').send({ role: 'admin' });
    expect(role.status).toBe(200);

    const p = await admin.post('/products').send({
      sku: 'timeline-1',
      name: 'Timeline Product',
      priceCents: 1000,
      currency: 'EUR',
    });
    expect(p.status).toBe(201);
    const productId = p.body.product.id;

    const buyer = request.agent(app);
    await register(buyer, 'test+timeline-buyer@example.com');

    const add = await buyer.post('/cart/items').send({ productId, quantity: 1 });
    expect(add.status).toBe(200);

    const checkout = await buyer.post('/orders');
    expect(checkout.status).toBe(201);
    const orderId = checkout.body.order.id;

    const paid = await admin.patch(`/admin/orders/${orderId}/status`).send({ status: 'paid' });
    expect(paid.status).toBe(200);

    const shipped = await admin.patch(`/admin/orders/${orderId}/status`).send({ status: 'shipped' });
    expect(shipped.status).toBe(200);

    const timeline = await admin.get(`/admin/orders/${orderId}/timeline`);
    expect(timeline.status).toBe(200);

    const events = timeline.body.events;
    expect(Array.isArray(events)).toBe(true);

    // expected: pending (system) + paid (admin) + shipped (admin)
    expect(events.length).toBe(3);

    expect(events[0].toStatus).toBe('pending');
    expect(events[0].source).toBe('system');

    expect(events[1].fromStatus).toBe('pending');
    expect(events[1].toStatus).toBe('paid');
    expect(events[1].source).toBe('admin');

    expect(events[2].fromStatus).toBe('paid');
    expect(events[2].toStatus).toBe('shipped');
    expect(events[2].source).toBe('admin');
  });

  it('user can fetch own timeline; other user gets 404', async () => {
    const admin = request.agent(app);
    await register(admin, 'test+timeline-admin2@example.com');
    const role = await admin.post('/__test__/set-role').send({ role: 'admin' });
    expect(role.status).toBe(200);

    const p = await admin.post('/products').send({
      sku: 'timeline-2',
      name: 'Timeline Product 2',
      priceCents: 500,
      currency: 'EUR',
    });
    expect(p.status).toBe(201);
    const productId = p.body.product.id;

    const buyer = request.agent(app);
    await register(buyer, 'test+timeline-buyer2@example.com');
    await buyer.post('/cart/items').send({ productId, quantity: 2 });

    const checkout = await buyer.post('/orders');
    expect(checkout.status).toBe(201);
    const orderId = checkout.body.order.id;

    const own = await buyer.get(`/orders/${orderId}/timeline`);
    expect(own.status).toBe(200);
    expect(own.body.events.length).toBe(1);
    expect(own.body.events[0].toStatus).toBe('pending');

    const other = request.agent(app);
    await register(other, 'test+timeline-other@example.com');

    const otherRes = await other.get(`/orders/${orderId}/timeline`);
    expect(otherRes.status).toBe(404);
  });
});
