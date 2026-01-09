import express from 'express';
import { z } from 'zod';

import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../errors/common.js';
import {
  createProduct,
  listActiveProducts,
  updateProductById
} from '../db/repositories/product-repository.js';

export const productsRouter = express.Router();

const productIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

const createProductBodySchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  priceCents: z.number().int().min(0),
  currency: z.string().min(3).max(3).optional(), // ISO 4217
  isActive: z.boolean().optional()
});

const patchProductBodySchema = z
  .object({
    sku: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    priceCents: z.number().int().min(0).optional(),
    currency: z.string().min(3).max(3).optional(),
    isActive: z.boolean().optional()
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Leerer Patch ist nicht erlaubt.'
  });

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
  validate({ body: createProductBodySchema }),
  async (req, res, next) => {
    try {
      const product = await createProduct(req.body);
      res.status(201).json({ product });
    } catch (err) {
      // Unique-Violations (23505) werden global gemappt -> 409 SKU_TAKEN
      next(err);
    }
  }
);

productsRouter.patch(
  '/:id',
  requireRole('admin'),
  validate({
    params: productIdParamsSchema,
    body: patchProductBodySchema
  }),
  async (req, res, next) => {
    try {
      const { id } = req.params; // durch validate() bereits number
      const product = await updateProductById(id, req.body);
      if (!product) throw new NotFoundError();
      res.status(200).json({ product });
    } catch (err) {
      // Unique-Violations (23505) werden global gemappt -> 409 SKU_TAKEN
      next(err);
    }
  }
);
