// apps/api/src/routes/products.js
import express from 'express';
import { z } from 'zod';
import Stripe from 'stripe';

import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { NotFoundError } from '../errors/common.js';
import { HttpError } from '../errors/http-error.js';
import {
  createProduct,
  listActiveProducts,
  getActiveProductById,
  getProductByIdAdmin,
  updateProductById,
  setStripeMappingById,
} from '../db/repositories/product-repository.js';

export const productsRouter = express.Router();

const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createBodySchema = z
  .object({
    sku: z.string().trim().min(1),
    name: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    priceCents: z.number().int().min(0),
    currency: z.string().trim().min(3).max(8).default('EUR'),
    isActive: z.boolean().optional(),
  })
  .strict();

const patchBodySchema = z
  .object({
    sku: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    description: z.string().nullable().optional(),
    priceCents: z.number().int().min(0).optional(),
    currency: z.string().trim().min(3).max(8).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'PATCH body darf nicht leer sein.',
  });

function stripeEnabled() {
  return process.env.NODE_ENV !== 'test' && Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY ?? '';
  if (!secret) {
    throw new HttpError({
      status: 500,
      code: 'STRIPE_NOT_CONFIGURED',
      message: 'Stripe ist serverseitig nicht konfiguriert (STRIPE_SECRET_KEY fehlt).',
    });
  }

  // Avoid hardcoding apiVersion (less brittle)
  return new Stripe(secret);
}

async function ensureStripeProductAndPrice({ stripe, dbProduct }) {
  let stripeProductId = dbProduct.stripeProductId ?? null;
  let stripePriceId = dbProduct.stripePriceId ?? null;

  // 1) Ensure Stripe Product exists
  if (!stripeProductId) {
    const created = await stripe.products.create({
      name: dbProduct.name,
      description: dbProduct.description ?? undefined,
      active: Boolean(dbProduct.isActive),
      metadata: {
        dbProductId: String(dbProduct.id),
        sku: String(dbProduct.sku),
      },
    });
    stripeProductId = created.id;
  }

  // 2) Ensure Price exists
  if (!stripePriceId) {
    const price = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: Number(dbProduct.priceCents),
      currency: String(dbProduct.currency ?? 'EUR').toLowerCase(),
    });
    stripePriceId = price.id;

    await stripe.products.update(stripeProductId, { default_price: stripePriceId });
  }

  return { stripeProductId, stripePriceId };
}

async function syncStripeProductUpdate({ stripe, stripeProductId, patchForStripeProduct }) {
  const keys = Object.keys(patchForStripeProduct);
  if (keys.length === 0) return;
  await stripe.products.update(stripeProductId, patchForStripeProduct);
}

async function syncStripePriceIfNeeded({ stripe, stripeProductId, nextPriceCents, nextCurrency }) {
  const price = await stripe.prices.create({
    product: stripeProductId,
    unit_amount: Number(nextPriceCents),
    currency: String(nextCurrency ?? 'EUR').toLowerCase(),
  });

  await stripe.products.update(stripeProductId, { default_price: price.id });

  return price.id;
}

/**
 * GET /products
 * Public: active only
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
 * Public: active only
 */
productsRouter.get(
  '/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const product = await getActiveProductById(id);
    if (!product) throw new NotFoundError('Produkt nicht gefunden.');
    res.status(200).json({ product });
  }),
);

/**
 * POST /products
 * Admin: create product in DB + create Stripe Product/Price + persist mapping
 */
productsRouter.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ body: createBodySchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;

    // 1) DB create
    const created = await createProduct({
      sku: input.sku,
      name: input.name,
      description: input.description ?? null,
      priceCents: input.priceCents,
      currency: input.currency ?? 'EUR',
      isActive: input.isActive ?? true,
    });

    // 2) Stripe sync (optional)
    let mapped = created;
    if (stripeEnabled()) {
      try {
        const stripe = getStripe();

        const { stripeProductId, stripePriceId } = await ensureStripeProductAndPrice({
          stripe,
          dbProduct: created,
        });

        mapped =
          (await setStripeMappingById(created.id, {
            stripeProductId,
            stripePriceId,
          })) ?? created;
      } catch (e) {
        throw new HttpError({
          status: 502,
          code: 'STRIPE_SYNC_FAILED',
          message: 'Stripe Sync fehlgeschlagen.',
          details: { reason: e?.message ?? String(e) },
        });
      }
    }

    // Do not expose stripe ids to the web; keep API shape stable
    const product = {
      id: mapped.id,
      sku: mapped.sku,
      name: mapped.name,
      description: mapped.description,
      priceCents: mapped.priceCents,
      currency: mapped.currency,
      isActive: mapped.isActive,
      createdAt: mapped.createdAt,
      updatedAt: mapped.updatedAt,
    };

    res.status(201).json({ product });
  }),
);

/**
 * PATCH /products/:id
 * Admin: update DB product + sync Stripe Product and/or create new Price if needed
 */
productsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('admin'),
  validate({ params: idParamsSchema, body: patchBodySchema }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const patch = req.body;

    const before = await getProductByIdAdmin(id);
    if (!before) throw new NotFoundError('Produkt nicht gefunden.');

    // 1) DB patch
    const updated = await updateProductById(id, patch);
    if (!updated) throw new NotFoundError('Produkt nicht gefunden.');

    // 2) Stripe sync (optional)
    let mapped = updated;
    if (stripeEnabled()) {
      try {
        const stripe = getStripe();

        // Ensure product+price exist if mapping missing
        let stripeProductId = before.stripeProductId ?? null;
        let stripePriceId = before.stripePriceId ?? null;

        if (!stripeProductId || !stripePriceId) {
          const ensured = await ensureStripeProductAndPrice({
            stripe,
            dbProduct: { ...updated, stripeProductId, stripePriceId },
          });
          stripeProductId = ensured.stripeProductId;
          stripePriceId = ensured.stripePriceId;

          mapped =
            (await setStripeMappingById(updated.id, {
              stripeProductId,
              stripePriceId,
            })) ?? mapped;
        }

        // Update Stripe product fields if changed
        const patchForStripeProduct = {};
        if (patch.name !== undefined) patchForStripeProduct.name = updated.name;
        if (patch.description !== undefined) {
          patchForStripeProduct.description = updated.description ?? undefined;
        }
        if (patch.isActive !== undefined) patchForStripeProduct.active = Boolean(updated.isActive);

        if (stripeProductId) {
          await syncStripeProductUpdate({
            stripe,
            stripeProductId,
            patchForStripeProduct,
          });
        }

        // If price/currency changed -> create new price + set default_price + persist mapping
        const priceChanged = patch.priceCents !== undefined || patch.currency !== undefined;
        if (priceChanged && stripeProductId) {
          const newStripePriceId = await syncStripePriceIfNeeded({
            stripe,
            stripeProductId,
            nextPriceCents: updated.priceCents,
            nextCurrency: updated.currency,
          });

          mapped =
            (await setStripeMappingById(updated.id, {
              stripeProductId,
              stripePriceId: newStripePriceId,
            })) ?? mapped;
        }
      } catch (e) {
        throw new HttpError({
          status: 502,
          code: 'STRIPE_SYNC_FAILED',
          message: 'Stripe Sync fehlgeschlagen.',
          details: { reason: e?.message ?? String(e) },
        });
      }
    }

    // Do not expose stripe ids to the web
    const product = {
      id: mapped.id,
      sku: mapped.sku,
      name: mapped.name,
      description: mapped.description,
      priceCents: mapped.priceCents,
      currency: mapped.currency,
      isActive: mapped.isActive,
      createdAt: mapped.createdAt,
      updatedAt: mapped.updatedAt,
    };

    res.status(200).json({ product });
  }),
);
