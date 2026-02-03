import express from 'express';
import { z } from 'zod';

import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { NotFoundError } from '../errors/common.js';
import {
  getOrderDetailsAdmin,
  listAllOrders
} from '../db/repositories/order-repository.js';

export const adminOrdersRouter = express.Router();

const orderIdParams = z.object({
  id: z.coerce.number().int().positive()
});

/**
 * GET /admin/orders
 * Admin: listet alle Orders (read-only).
 */
adminOrdersRouter.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const orders = await listAllOrders();
    res.status(200).json({ orders });
  })
);

/**
 * GET /admin/orders/:id
 * Admin: Order-Details inkl. Items (read-only).
 */
adminOrdersRouter.get(
  '/:id',
  requireRole('admin'),
  validate({ params: orderIdParams }),
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);

    const details = await getOrderDetailsAdmin(orderId);
    if (!details) throw new NotFoundError('Bestellung nicht gefunden.');

    res.status(200).json(details);
  })
);