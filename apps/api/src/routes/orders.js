import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/require-auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { NotFoundError } from '../errors/common.js';
import {
  createOrderFromCart,
  getOrderDetails,
  listOrdersByUser
} from '../db/repositories/order-repository.js';

export const ordersRouter = express.Router();

const orderIdParams = z.object({
  id: z.coerce.number().int().positive()
});

function ensureCart(req) {
  if (!req.session.cart) req.session.cart = { items: [] };
  if (!Array.isArray(req.session.cart.items)) req.session.cart.items = [];
  return req.session.cart;
}

/**
 * POST /orders
 * Checkout: erzeugt eine Bestellung aus dem Cart und leert den Cart.
 */
ordersRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const cart = ensureCart(req);

    const userId = Number(req.session.user.id);
    const result = await createOrderFromCart(userId, cart.items);

    // Cart leeren nach erfolgreichem Checkout
    req.session.cart = { items: [] };

    res.status(201).json(result);
  })
);

/**
 * GET /orders/me
 * Listet Orders des eingeloggten Users.
 */
ordersRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = Number(req.session.user.id);
    const orders = await listOrdersByUser(userId);
    res.status(200).json({ orders });
  })
);

/**
 * GET /orders/:id
 * Order-Details für eingeloggten User.
 */
ordersRouter.get(
  '/:id',
  requireAuth,
  validate({ params: orderIdParams }),
  asyncHandler(async (req, res) => {
    const userId = Number(req.session.user.id);
    const orderId = Number(req.params.id);

    const details = await getOrderDetails(userId, orderId);
    if (!details) throw new NotFoundError('Bestellung nicht gefunden.');

    res.status(200).json(details);
  })
);
