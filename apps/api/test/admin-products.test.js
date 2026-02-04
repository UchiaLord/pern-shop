// apps/api/test/admin-products.test.js
import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';

function uniqueEmail(prefix) {
  const n = Date.now();
  return `${prefix}.${n}@example.com`;
}

async function registerAndLoginAgent(app, { email, password }) {
  const agent = request.agent(app);

  const reg = await agent.post('/auth/register').send({ email, password });
  expect([201, 409]).toContain(reg.status);

  const login = await agent.post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);

  return agent;
}

async function setRole(agent, role) {
  const res = await agent.post('/__test__/set-role').send({ role });
  expect(res.status).toBe(200);
}

describe('Admin Products: /admin/products + public /products', () => {
  it('GET /products is public and returns only active products', async () => {
    const app = createApp();

    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);

    for (const p of res.body.products) {
      // Contract: public listActiveProducts
      expect(p.isActive).toBe(true);
    }
  });

  it('GET /admin/products -> 401 without login', async () => {
    const app = createApp();

    const res = await request(app).get('/admin/products');
    expect(res.status).toBe(401);
    expect(res.body?.error?.code).toBe('UNAUTHENTICATED');
  });

  it('GET /admin/products -> 403 as customer', async () => {
    const app = createApp();

    const agent = await registerAndLoginAgent(app, {
      email: uniqueEmail('customer'),
      password: 'Password123!',
    });

    // Ensure non-admin
    await setRole(agent, 'customer');

    const res = await agent.get('/admin/products');
    expect(res.status).toBe(403);
    expect(res.body?.error?.code).toBe('FORBIDDEN');
  });

  it('Admin sees inactive products in /admin/products, but not in /products', async () => {
    const app = createApp();

    const agent = await registerAndLoginAgent(app, {
      email: uniqueEmail('admin'),
      password: 'Password123!',
    });

    await setRole(agent, 'admin');

    // Create active product
    const createRes = await agent.post('/products').send({
      sku: `SKU-${Date.now()}`,
      name: 'Test Product',
      description: null,
      priceCents: 1999,
      currency: 'EUR',
      isActive: true,
    });

    expect(createRes.status).toBe(201);
    const created = createRes.body.product;
    expect(created).toBeTruthy();
    expect(created.isActive).toBe(true);

    // Deactivate
    const patchRes = await agent.patch(`/products/${created.id}`).send({ isActive: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.product.isActive).toBe(false);

    // Admin list includes it
    const adminList = await agent.get('/admin/products');
    expect(adminList.status).toBe(200);
    expect(Array.isArray(adminList.body.products)).toBe(true);
    expect(adminList.body.products.some((p) => p.id === created.id && p.isActive === false)).toBe(true);

    // Public list does NOT include it
    const publicList = await request(app).get('/products');
    expect(publicList.status).toBe(200);
    expect(publicList.body.products.some((p) => p.id === created.id)).toBe(false);
  });

  it('PATCH /products/:id -> 400 on empty patch (validation)', async () => {
    const app = createApp();

    const agent = await registerAndLoginAgent(app, {
      email: uniqueEmail('admin2'),
      password: 'Password123!',
    });

    await setRole(agent, 'admin');

    const createRes = await agent.post('/products').send({
      sku: `SKU-${Date.now()}`,
      name: 'Patch Validation Product',
      description: null,
      priceCents: 999,
      currency: 'EUR',
      isActive: true,
    });

    expect(createRes.status).toBe(201);
    const productId = createRes.body.product.id;

    const patchRes = await agent.patch(`/products/${productId}`).send({});
    expect(patchRes.status).toBe(400);

    // Code kann je nach Error-Mapping variieren; wir prüfen minimal den Contract:
    expect(patchRes.body?.error).toBeTruthy();
    expect(typeof patchRes.body.error.code).toBe('string');
  });
});
