// apps/api/test/payment.test.js
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Stripe Mock (ESM default export) ----
let stripeCreateCalls = 0;
let stripeRetrieveCalls = 0;

let nextPiId = 'pi_test_1';
let nextClientSecret = 'cs_test_1';

vi.mock('stripe', () => {
  class StripeMock {
    constructor() {
      this.paymentIntents = {
        create: vi.fn(async () => {
          stripeCreateCalls += 1;
          return { id: nextPiId, client_secret: nextClientSecret };
        }),
        retrieve: vi.fn(async () => {
          stripeRetrieveCalls += 1;
          return { id: nextPiId, client_secret: nextClientSecret };
        }),
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

async function makeAdminAndProduct(app, { sku, name, priceCents }) {
  const admin = request.agent(app);

  await register(admin, `test+admin+${sku}@example.com`);

  const role = await admin.post('/__test__/set-role').send({ role: 'admin' });
  expect(role.status).toBe(200);

  const created = await admin.post('/products').send({
    sku,
    name,
    priceCents,
    currency: 'EUR',
  });
  expect(created.status).toBe(201);

  return { admin, productId: created.body.product.id };
}

describe('Payments (Day 31 hardening)', () => {
  let createApp;
  let app;

  const envBackup = {};

  beforeEach(async () => {
    stripeCreateCalls = 0;
    stripeRetrieveCalls = 0;

    nextPiId = 'pi_test_1';
    nextClientSecret = 'cs_test_1';

    envBackup.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    envBackup.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

    // Keep NODE_ENV === 'test' so __test__ routes exist.
    // Enable Stripe flow via secrets (Stripe SDK is mocked).
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

  it('POST /payments/create-intent is idempotent for same cart snapshot (reuses same order + PI)', async () => {
    const { productId } = await makeAdminAndProduct(app, {
      sku: 'pay-idem-1',
      name: 'Idempotency Product',
      priceCents: 500,
    });

    const buyer = request.agent(app);
    await register(buyer, 'test+buyer+idem1@example.com');

    const add = await buyer.post('/cart/items').send({ productId, quantity: 2 });
    expect(add.status).toBe(200);

    const first = await buyer.post('/payments/create-intent');
    expect(first.status).toBe(201);
    expect(first.body.orderId).toBeTypeOf('number');
    expect(first.body.clientSecret).toBe('cs_test_1');

    const firstOrderId = first.body.orderId;

    const second = await buyer.post('/payments/create-intent');
    expect(second.status).toBe(200);
    expect(second.body.orderId).toBe(firstOrderId);
    expect(second.body.clientSecret).toBe('cs_test_1');

    expect(stripeCreateCalls).toBe(1);
    expect(stripeRetrieveCalls).toBe(1);

    const list = await buyer.get('/orders/me');
    expect(list.status).toBe(200);
    expect(list.body.orders.length).toBe(1);
    expect(list.body.orders[0].id).toBe(firstOrderId);
  });

  it('POST /payments/create-intent creates a new order if cart snapshot changes', async () => {
    const { productId } = await makeAdminAndProduct(app, {
      sku: 'pay-idem-2',
      name: 'Idempotency Product 2',
      priceCents: 300,
    });

    const buyer = request.agent(app);
    await register(buyer, 'test+buyer+idem2@example.com');

    const add = await buyer.post('/cart/items').send({ productId, quantity: 1 });
    expect(add.status).toBe(200);

    nextPiId = 'pi_test_a';
    nextClientSecret = 'cs_test_a';

    const first = await buyer.post('/payments/create-intent');
    expect(first.status).toBe(201);
    const orderA = first.body.orderId;

    const addAgain = await buyer.post('/cart/items').send({ productId, quantity: 2 });
    expect(addAgain.status).toBe(200);

    nextPiId = 'pi_test_b';
    nextClientSecret = 'cs_test_b';

    const second = await buyer.post('/payments/create-intent');
    expect(second.status).toBe(201);
    const orderB = second.body.orderId;

    expect(orderB).not.toBe(orderA);
    expect(stripeCreateCalls).toBe(2);

    const list = await buyer.get('/orders/me');
    expect(list.status).toBe(200);
    expect(list.body.orders.length).toBe(2);
  });

  it('Stripe webhook: payment_intent.payment_failed marks order as cancelled (idempotent)', async () => {
    const { productId } = await makeAdminAndProduct(app, {
      sku: 'pay-fail-1',
      name: 'Failure Product',
      priceCents: 999,
    });

    const buyer = request.agent(app);
    await register(buyer, 'test+buyer+fail1@example.com');

    const add = await buyer.post('/cart/items').send({ productId, quantity: 1 });
    expect(add.status).toBe(200);

    nextPiId = 'pi_fail_1';
    nextClientSecret = 'cs_fail_1';

    const created = await buyer.post('/payments/create-intent');
    expect(created.status).toBe(201);
    const orderId = created.body.orderId;

    globalThis.__STRIPE_EVENT__ = {
      id: 'evt_test_fail_1',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_fail_1',
          metadata: { orderId: String(orderId) },
          last_payment_error: { message: 'Card declined' },
        },
      },
    };

    const wh1 = await request(app)
      .post('/webhooks/stripe')
      .set('stripe-signature', 'sig_dummy')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ hello: 'world' })));

    expect(wh1.status).toBe(200);

    const detailsAfter = await buyer.get(`/orders/${orderId}`);
    expect(detailsAfter.status).toBe(200);
    expect(detailsAfter.body.order.status).toBe('cancelled');

    const wh2 = await request(app)
      .post('/webhooks/stripe')
      .set('stripe-signature', 'sig_dummy')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ hello: 'world' })));

    expect(wh2.status).toBe(200);

    const detailsAfter2 = await buyer.get(`/orders/${orderId}`);
    expect(detailsAfter2.status).toBe(200);
    expect(detailsAfter2.body.order.status).toBe('cancelled');
  });
});
