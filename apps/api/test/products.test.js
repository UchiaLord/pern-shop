import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';

const app = createApp();

describe('Products', () => {
  it('GET /products -> 200 und leere Liste', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.products)).toBe(true);
    expect(res.body.products).toHaveLength(0);
  });

  it('POST /products -> 401 ohne Login, 403 als customer, 201 als admin', async () => {
    const agent = request.agent(app);

    // Ohne Login -> 401
    const noLogin = await agent.post('/products').send({
      sku: 'test-sku-1',
      name: 'Test Produkt',
      priceCents: 1999,
    });
    expect(noLogin.status).toBe(401);

    // Register -> default role customer -> 403
    await agent.post('/auth/register').send({
      email: 'test+products@example.com',
      password: 'SehrSicheresPasswort123!',
    });

    const asCustomer = await agent.post('/products').send({
      sku: 'test-sku-1',
      name: 'Test Produkt',
      priceCents: 1999,
    });
    expect(asCustomer.status).toBe(403);

    // Test-only: Rolle auf admin setzen -> 201
    const setRole = await agent.post('/__test__/set-role').send({ role: 'admin' });
    expect(setRole.status).toBe(200);

    const created = await agent.post('/products').send({
      sku: 'test-sku-1',
      name: 'Test Produkt',
      description: 'Beschreibung',
      priceCents: 1999,
      currency: 'EUR',
    });

    expect(created.status).toBe(201);
    expect(created.body?.product?.sku).toBe('test-sku-1');
  });

  it('GET /products zeigt nur aktive Produkte', async () => {
    // Setup gezielt hier (damit der Test unabhängig bleibt)
    await pool.query(`
      INSERT INTO products (sku, name, description, price_cents, currency, is_active)
      VALUES
        ('test-a', 'Test A', NULL, 1234, 'EUR', true),
        ('test-b', 'Test B', NULL, 5678, 'EUR', false)
    `);

    const res = await request(app).get('/products');
    expect(res.status).toBe(200);

    const skus = res.body.products.map((p) => p.sku);
    expect(skus).toContain('test-a');
    expect(skus).not.toContain('test-b');
  });

  it('PATCH /products/:id deaktiviert Produkt', async () => {
    const agent = request.agent(app);

    await agent.post('/auth/register').send({
      email: 'test+admin@example.com',
      password: 'SehrSicheresPasswort123!',
    });

    const setRole = await agent.post('/__test__/set-role').send({ role: 'admin' });
    expect(setRole.status).toBe(200);

    const created = await agent.post('/products').send({
      sku: 'test-patch-b',
      name: 'B',
      priceCents: 200,
      currency: 'EUR',
      isActive: true,
    });
    expect(created.status).toBe(201);

    const id = created.body.product.id;

    const patch = await agent.patch(`/products/${id}`).send({ isActive: false });
    expect(patch.status).toBe(200);
    expect(patch.body.product.isActive).toBe(false);

    const list = await request(app).get('/products');
    expect(list.status).toBe(200);

    const skus = list.body.products.map((p) => p.sku);
    expect(skus).not.toContain('test-patch-b');
  });
});