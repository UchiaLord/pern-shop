import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';
import { createOrderFromCart } from '../src/db/repositories/order-repository.js';

const app = createApp();

describe('Admin order details - allowedNextStatuses', () => {
  async function seedAdminAndPendingOrder() {
    const admin = request.agent(app);
    const adminReg = await admin.post('/auth/register').send({
      email: 'test+admin-allowednext@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    expect(adminReg.status).toBe(201);

    const roleRes = await admin.post('/__test__/set-role').send({ role: 'admin' });
    expect(roleRes.status).toBe(200);

    const p = await admin.post('/products').send({
      sku: 'test-allowednext-1',
      name: 'AllowedNext Produkt',
      priceCents: 500,
      currency: 'EUR',
    });
    expect(p.status).toBe(201);

    const productId = Number(p.body?.product?.id);
    expect(Number.isInteger(productId)).toBe(true);

    const buyer = request.agent(app);
    const buyerReg = await buyer.post('/auth/register').send({
      email: 'test+buyer-allowednext@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    expect(buyerReg.status).toBe(201);

    const buyerId = Number(buyerReg.body?.user?.id);
    expect(Number.isInteger(buyerId)).toBe(true);

    const created = await createOrderFromCart(buyerId, [{ productId, quantity: 2 }]);
    expect(created?.order?.id).toBeTruthy();
    expect(created.order.status).toBe('pending');

    return { admin, orderId: created.order.id };
  }

  it('returns allowedNextStatuses for pending', async () => {
    const { admin, orderId } = await seedAdminAndPendingOrder();

    const res = await admin.get(`/admin/orders/${orderId}`);
    expect(res.status).toBe(200);

    const allowed = res.body?.order?.allowedNextStatuses;
    expect(Array.isArray(allowed)).toBe(true);

    // pending -> paid,cancelled
    expect(allowed).toContain('paid');
    expect(allowed).toContain('cancelled');
    expect(allowed).not.toContain('shipped');
    expect(allowed).not.toContain('completed');
  });
});