import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';

const app = createApp();

describe('Cart & Orders', () => {
  it('Cart: add -> get -> remove', async () => {
    const agent = request.agent(app);

    // User registrieren (customer)
    await agent.post('/auth/register').send({
      email: 'test+cart@example.com',
      password: 'SehrSicheresPasswort123!',
    });

    // Admin erzeugen + Produkt anlegen
    const admin = request.agent(app);
    await admin.post('/auth/register').send({
      email: 'test+admincart@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    await admin.post('/__test__/set-role').send({ role: 'admin' });

    const created = await admin.post('/products').send({
      sku: 'test-cart-1',
      name: 'Cart Produkt',
      priceCents: 1234,
      currency: 'EUR',
    });
    expect(created.status).toBe(201);

    const productId = created.body.product.id;

    // add item
    const add = await agent.post('/cart/items').send({ productId, quantity: 2 });
    expect(add.status).toBe(200);

    // get cart
    const cart = await agent.get('/cart');
    expect(cart.status).toBe(200);
    expect(cart.body.cart.items.length).toBe(1);
    expect(cart.body.cart.subtotalCents).toBe(2468);

    // remove item
    const del = await agent.delete(`/cart/items/${productId}`);
    expect(del.status).toBe(204);

    const cartAfter = await agent.get('/cart');
    expect(cartAfter.status).toBe(200);
    expect(cartAfter.body.cart.items.length).toBe(0);
    expect(cartAfter.body.cart.subtotalCents).toBe(0);
  });

  it('Checkout: erstellt Order, friert Preise ein, leert Cart', async () => {
    const admin = request.agent(app);
    await admin.post('/auth/register').send({
      email: 'test+admincheckout@example.com',
      password: 'SehrSicheresPasswort123!',
    });
    await admin.post('/__test__/set-role').send({ role: 'admin' });

    const p = await admin.post('/products').send({
      sku: 'test-checkout-1',
      name: 'Checkout Produkt',
      priceCents: 500,
      currency: 'EUR',
    });
    expect(p.status).toBe(201);
    const productId = p.body.product.id;

    const agent = request.agent(app);
    await agent.post('/auth/register').send({
      email: 'test+buyer@example.com',
      password: 'SehrSicheresPasswort123!',
    });

    await agent.post('/cart/items').send({ productId, quantity: 3 });

    const checkout = await agent.post('/orders');
    expect(checkout.status).toBe(201);

    // status lifecycle default
    expect(checkout.body.order.status).toBe('pending');

    expect(checkout.body.order.subtotalCents).toBe(1500);
    expect(checkout.body.items.length).toBe(1);
    expect(checkout.body.items[0].unitPriceCents).toBe(500);
    expect(checkout.body.items[0].quantity).toBe(3);

    // Cart ist leer
    const cartAfter = await agent.get('/cart');
    expect(cartAfter.status).toBe(200);
    expect(cartAfter.body.cart.items.length).toBe(0);

    // Order Listing
    const list = await agent.get('/orders/me');
    expect(list.status).toBe(200);
    expect(list.body.orders.length).toBe(1);

    // status visible in list
    expect(list.body.orders[0].status).toBe('pending');

    const orderId = list.body.orders[0].id;

    // Details
    const details = await agent.get(`/orders/${orderId}`);
    expect(details.status).toBe(200);
    expect(details.body.order.id).toBe(orderId);

    // status visible in details
    expect(details.body.order.status).toBe('pending');

    expect(details.body.items.length).toBe(1);
    expect(details.body.items[0].lineTotalCents).toBe(1500);

    // Preis im Produkt ändern, Order bleibt gleich (eingefroren)
    const patch = await admin.patch(`/products/${productId}`).send({ priceCents: 999 });
    expect(patch.status).toBe(200);

    const detailsAfter = await agent.get(`/orders/${orderId}`);
    expect(detailsAfter.status).toBe(200);
    expect(detailsAfter.body.items[0].unitPriceCents).toBe(500);

    // status stays stable
    expect(detailsAfter.body.order.status).toBe('pending');
  });

  it('Checkout: 400 CART_EMPTY wenn Cart leer ist', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({
      email: 'test+emptycart@example.com',
      password: 'SehrSicheresPasswort123!',
    });

    const checkout = await agent.post('/orders');
    expect(checkout.status).toBe(400);
    expect(checkout.body?.error?.code).toBe('CART_EMPTY');
  });
});