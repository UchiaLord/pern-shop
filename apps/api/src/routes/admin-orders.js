import express from 'express';
import { z } from 'zod';

import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  listAllOrdersAdmin,
  getOrderDetailsAdmin,
  updateOrderStatusAdmin,
} from '../db/repositories/order-repository.js';

export const adminOrdersRouter = express.Router();

// Admin-only for everything in this router
adminOrdersRouter.use(requireRole('admin'));

const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'shipped', 'completed', 'cancelled']),
});

/**
 * GET /admin/orders
 * Listet alle Orders (read-only Ansicht).
 */
adminOrdersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const orders = await listAllOrdersAdmin();
    res.status(200).json({ orders });
  }),
);

/**
 * GET /admin/orders/:id
 * Details einer Order inkl. Items (read-only).
 */
adminOrdersRouter.get(
  '/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const details = await getOrderDetailsAdmin(id);
    res.status(200).json(details);
  }),
);

/**
 * PATCH /admin/orders/:id/status
 * Admin kann Status ändern (mit Transition-Guards).
 */
adminOrdersRouter.patch(
  '/:id/status',
  validate({ params: idParamsSchema, body: updateStatusSchema }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;

    const updated = await updateOrderStatusAdmin(id, status);
    res.status(200).json({ order: updated });
  }),
);