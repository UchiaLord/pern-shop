import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/require-auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { pool } from '../db/pool.js';

export const cartRouter = express.Router();

const addItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(999),
});

const removeParamsSchema = z.object({
  productId: z.coerce.number().int().positive(),
});

/**
 * Interne Helper: Warenkorb initialisieren.
 */
function ensureCart(req) {
  if (!req.session.cart) {
    req.session.cart = { items: [] };
  }
  if (!Array.isArray(req.session.cart.items)) {
    req.session.cart.items = [];
  }
  return req.session.cart;
}

/**
 * GET /cart
 * Liefert den Warenkorb (mit Produktdetails und Totals).
 */
cartRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const cart = ensureCart(req);
    const items = cart.items;

    if (items.length === 0) {
      return res.status(200).json({
        cart: { items: [], subtotalCents: 0, currency: 'EUR' },
      });
    }

    const ids = items.map((i) => i.productId);

    const productsRes = await pool.query(
      `
      SELECT id, sku, name, price_cents, currency, is_active
      FROM products
      WHERE id = ANY($1::bigint[])
      `,
      [ids],
    );

    const productsById = new Map(productsRes.rows.map((p) => [Number(p.id), p]));

    let currency = null;
    const detailed = [];
    let subtotalCents = 0;

    for (const i of items) {
      const p = productsById.get(i.productId);
      if (!p) continue; // Produkt gelöscht -> ignorieren (alternativ: aus cart entfernen)
      if (!p.is_active) continue; // inaktiv -> nicht im Checkout, aber cart darf existieren

      const pCurrency = p.currency ?? 'EUR';
      if (!currency) currency = pCurrency;
      if (currency !== pCurrency) {
        // Mixed currency: wir zeigen trotzdem an, subtotal ist dann unzuverlässig.
        // Für Day 07 verhindern wir Mixed Currency beim Checkout.
      }

      const unitPriceCents = Number(p.price_cents);
      const lineTotalCents = unitPriceCents * Number(i.quantity);
      subtotalCents += lineTotalCents;

      detailed.push({
        productId: Number(p.id),
        sku: p.sku,
        name: p.name,
        currency: pCurrency,
        unitPriceCents,
        quantity: Number(i.quantity),
        lineTotalCents,
      });
    }

    res.status(200).json({
      cart: {
        items: detailed,
        subtotalCents,
        currency: currency ?? 'EUR',
      },
    });
  }),
);

/**
 * POST /cart/items
 * Fügt ein Item hinzu oder aktualisiert die Menge.
 */
cartRouter.post(
  '/items',
  requireAuth,
  validate({ body: addItemSchema }),
  asyncHandler(async (req, res) => {
    const cart = ensureCart(req);

    const { productId, quantity } = req.body;

    const existing = cart.items.find((i) => i.productId === productId);
    if (existing) {
      existing.quantity = quantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    res.status(200).json({ ok: true });
  }),
);

/**
 * DELETE /cart/items/:productId
 * Entfernt ein Item aus dem Cart.
 */
cartRouter.delete(
  '/items/:productId',
  requireAuth,
  validate({ params: removeParamsSchema }),
  asyncHandler(async (req, res) => {
    const cart = ensureCart(req);
    const productId = Number(req.params.productId);

    cart.items = cart.items.filter((i) => i.productId !== productId);

    res.status(204).send();
  }),
);
