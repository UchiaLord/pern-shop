import express from 'express';
import { z } from 'zod';

import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { BadRequestError, NotFoundError } from '../errors/common.js';
import { createProduct, listActiveProducts, updateProductById } from '../db/repositories/product-repository.js';

export const productsRouter = express.Router();

productsRouter.get('/', async (_req, res, next) => {
  try {
    const products = await listActiveProducts();
    res.status(200).json({ products });
  } catch (err) {
    next(err);
  }
});

productsRouter.post(
  '/',
  requireRole('admin'),
  validate({
    body: z.object({
      sku: z.string().min(1),
      name: z.string().min(1),
      description: z.string().nullable().optional(),
      priceCents: z.number().int().min(0),
      currency: z.string().min(3).max(3).optional(), // ISO 4217, minimal
      isActive: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const product = await createProduct(req.body);
      res.status(201).json({ product });
    } catch (err) {
      // optional: unique violation (23505) auf SKU -> 409
      if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
        return res.status(409).json({
          error: { code: 'SKU_TAKEN', message: 'SKU ist bereits vergeben.' },
        });
      }
      next(err);
    }
  },
);

productsRouter.patch(
  '/:id',
  requireRole('admin'),
  validate({
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
    body: z
      .object({
        sku: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        priceCents: z.number().int().min(0).optional(),
        currency: z.string().min(3).max(3).optional(),
        isActive: z.boolean().optional(),
      })
      .refine((obj) => Object.keys(obj).length > 0, { message: 'Leerer Patch ist nicht erlaubt.' }),
  }),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) throw new BadRequestError('Ungültige ID.');

      const product = await updateProductById(id, req.body);
      if (!product) throw new NotFoundError();

      res.status(200).json({ product });
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
        return res.status(409).json({
          error: { code: 'SKU_TAKEN', message: 'SKU ist bereits vergeben.' },
        });
      }
      next(err);
    }
  },
);
