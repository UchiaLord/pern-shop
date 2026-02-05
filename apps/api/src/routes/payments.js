// apps/api/src/routes/payments.js
import express from 'express';
import Stripe from 'stripe';

import { requireAuth } from '../middleware/require-auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../errors/http-error.js';
import { createOrderFromCart, attachPaymentIntentToOrder } from '../db/repositories/order-repository.js';

export const paymentsRouter = express.Router();

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
  return new Stripe(secret);
}

/**
 * POST /payments/create-intent
 * - creates order from session cart
 * - clears cart
 * - creates PaymentIntent with metadata { orderId, userId }
 * - persists payment_intent_id on order
 * - returns { orderId, clientSecret }
 */
paymentsRouter.post(
  '/create-intent',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!stripeEnabled()) {
      throw new HttpError({
        status: 400,
        code: 'STRIPE_DISABLED',
        message: 'Stripe ist nicht aktiv (test/prod config fehlt).',
      });
    }

    const items = req.session?.cart?.items ?? [];
    const userId = req.session?.user?.id;

    if (!userId) {
      throw new HttpError({ status: 401, code: 'UNAUTHORIZED', message: 'Nicht eingeloggt.' });
    }

    // 1) Create order (freezes prices)
    const created = await createOrderFromCart(userId, items);

    // 2) Clear cart (idempotent)
    if (req.session?.cart) {
      req.session.cart.items = [];
    }

    const orderId = created.order.id;

    // 3) Create PaymentIntent
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.create({
      amount: Number(created.order.subtotalCents),
      currency: String(created.order.currency ?? 'EUR').toLowerCase(),
      metadata: {
        orderId: String(orderId),
        userId: String(userId),
      },
      automatic_payment_methods: { enabled: true },
    });

    const clientSecret = pi.client_secret;
    if (!clientSecret) {
      throw new HttpError({
        status: 502,
        code: 'STRIPE_CREATE_INTENT_FAILED',
        message: 'Stripe PaymentIntent client_secret fehlt.',
      });
    }

    // 4) Persist PI on order (idempotent / conflict-safe)
    await attachPaymentIntentToOrder(orderId, pi.id);

    res.status(201).json({ orderId, clientSecret });
  }),
);

// same reason as webhooks: robust against default-import usage
export default paymentsRouter;
