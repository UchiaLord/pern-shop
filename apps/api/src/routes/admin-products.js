// apps/api/src/routes/admin-products.js
import express from 'express';

import { requireRole } from '../middleware/require-role.js';
import { asyncHandler } from '../utils/async-handler.js';
import { listAllProducts } from '../db/repositories/product-repository.js';

export const adminProductsRouter = express.Router();

// Admin-only für alles hier
adminProductsRouter.use(requireRole('admin'));

/**
 * GET /admin/products
 * Listet alle Produkte (active + inactive) für Admin UI.
 */
adminProductsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const products = await listAllProducts();
    res.status(200).json({ products });
  }),
);
