import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';
import { createOrderFromCart } from '../src/db/repositories/order-repository.js';

const app = createApp();

describe('Admin order status - reason', () => {
  async function seedAdminAndOrder() {
    // --- Admin anlegen + Rolle setzen ---
    const admin = request.agent(app);
    const adminReg = await admin.post('/auth/register').send({
      email: 'test+admin-reason@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    expect(adminReg.status).toBe(201);

    const roleRes = await admin.post('/__test__/set-role').send({ role: 'admin' });
    expect(roleRes.status).toBe(200);

    // --- Produkt anlegen (admin-only) ---
    const p = await admin.post('/products').send({
      sku: 'test-reason-1',
      name: 'Reason Produkt',
      priceCents: 500,
      currency: 'EUR',
    });
    expect(p.status).toBe(201);

    const productId = Number(p.body?.product?.id);
    expect(Number.isInteger(productId)).toBe(true);

    // --- Buyer anlegen (normaler User) ---
    const buyer = request.agent(app);
    const buyerReg = await buyer.post('/auth/register').send({
      email: 'test+buyer-reason@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    expect(buyerReg.status).toBe(201);

    const buyerId = Number(buyerReg.body?.user?.id);
    expect(Number.isInteger(buyerId)).toBe(true);

    // --- Order direkt via Repo erstellen (wie in admin-orders.test.js) ---
    const created = await createOrderFromCart(buyerId, [{ productId, quantity: 2 }]);
    expect(created?.order?.id).toBeTruthy();
    expect(created.order.status).toBe('pending');

    return { admin, buyer, orderId: created.order.id };
  }

  it('stores reason in status events', async () => {
    const { admin, orderId } = await seedAdminAndOrder();

    const reason = 'Customer asked for faster processing.';
    const statusRes = await admin
      .patch(`/admin/orders/${orderId}/status`)
      .send({ status: 'paid', reason });

    expect(statusRes.status).toBe(200);

    // Details müssen statusEvents enthalten (Order hat Audit-Log)
    const detailRes = await admin.get(`/admin/orders/${orderId}`);
    expect(detailRes.status).toBe(200);

    const events = detailRes.body?.order?.statusEvents;
    expect(Array.isArray(events)).toBe(true);

    const last = events[events.length - 1];
    expect(last.toStatus).toBe('paid');
    expect(last.reason).toBe(reason);
  });

  it('rejects reason longer than 500 chars', async () => {
    const { admin, orderId } = await seedAdminAndOrder();

    const longReason = 'x'.repeat(501);

    const statusRes = await admin
      .patch(`/admin/orders/${orderId}/status`)
      .send({ status: 'paid', reason: longReason });

    expect(statusRes.status).toBe(400);

    // optional: wenn eure validate-middleware ein Error-Objekt liefert
    const code = statusRes.body?.error?.code;
    if (code) expect(code).toMatch(/VALIDATION/i);
  });
});