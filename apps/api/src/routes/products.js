import express from 'express';
import { z } from 'zod';

import { NotFoundError } from '../errors/common.js';
import {
  createProduct,
  findActiveProductById,
  listActiveProducts,
  updateProduct,
} from '../db/repositories/product-repository.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';

export const productsRouter = express.Router();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createBodySchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  priceCents: z.number().int().min(0),
  currency: z.string().trim().min(3).max(3).optional(), // ISO 4217, optional
});

const patchBodySchema = z
  .object({
    sku: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    priceCents: z.number().int().min(0).optional(),
    currency: z.string().trim().min(3).max(3).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Mindestens ein Feld muss gesetzt sein.',
  });

/**
 * GET /products
 * Öffentlich: listet aktive Produkte.
 */
productsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const products = await listActiveProducts();
    res.status(200).json({ products });
  }),
);

/**
 * GET /products/:id
 * Öffentlich: liefert aktives Produkt.
 */
productsRouter.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const product = await findActiveProductById(id);
    if (!product) throw new NotFoundError('Produkt nicht gefunden.');
    res.status(200).json({ product });
  }),
);

/**
 * POST /products
 * Admin-only: Produkt anlegen.
 */
productsRouter.post(
  '/',
  requireRole('admin'),
  validate({ body: createBodySchema }),
  asyncHandler(async (req, res) => {
    try {
      const product = await createProduct(req.body);
      res.status(201).json({ product });
    } catch (err) {
      // SKU unique violation
      if (err && typeof err === 'object' && err.code === '23505') {
        return res.status(409).json({
          error: { code: 'SKU_TAKEN', message: 'SKU ist bereits vergeben.' },
        });
      }
      throw err;
    }
  }),
);

/**
 * PATCH /products/:id
 * Admin-only: Produkt aktualisieren.
 */
productsRouter.patch(
  '/:id',
  requireRole('admin'),
  validate({ params: idParamSchema, body: patchBodySchema }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    try {
      const product = await updateProduct(id, req.body);
      if (!product) throw new NotFoundError('Produkt nicht gefunden.');
      res.status(200).json({ product });
    } catch (err) {
      if (err && typeof err === 'object' && err.code === '23505') {
        return res.status(409).json({
          error: { code: 'SKU_TAKEN', message: 'SKU ist bereits vergeben.' },
        });
      }
      throw err;
    }
  }),
);
