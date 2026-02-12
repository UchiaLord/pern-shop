// apps/api/src/routes/webhooks.js
import express from 'express';
import Stripe from 'stripe';

import { HttpError } from '../errors/http-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { markOrderPaidByWebhook } from '../db/repositories/order-repository.js';

export const stripeWebhooksRouter = express.Router();

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

function getWebhookSecret() {
  const whsec = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  if (!whsec) {
    throw new HttpError({
      status: 500,
      code: 'STRIPE_WEBHOOK_NOT_CONFIGURED',
      message: 'Stripe Webhook Secret fehlt (STRIPE_WEBHOOK_SECRET).',
    });
  }
  return whsec;
}

/**
 * POST /webhooks/stripe
 * WICHTIG:
 * - app.js mountet: app.use('/webhooks/stripe', express.raw(...), stripeWebhooksRouter)
 * - daher MUSS der Handler hier auf '/' liegen (nicht auf '/stripe')
 */
stripeWebhooksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const stripe = getStripe();
    const webhookSecret = getWebhookSecret();

    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      throw new HttpError({
        status: 400,
        code: 'STRIPE_SIGNATURE_MISSING',
        message: 'stripe-signature header fehlt.',
      });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (e) {
      throw new HttpError({
        status: 400,
        code: 'STRIPE_SIGNATURE_INVALID',
        message: 'Ungültige Stripe Signatur.',
        details: { reason: e?.message ?? String(e) },
      });
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data?.object;
      const paymentIntentId = pi?.id;
      const orderIdRaw = pi?.metadata?.orderId;

      const orderId = Number(orderIdRaw);
      if (!Number.isFinite(orderId) || orderId <= 0) {
        throw new HttpError({
          status: 400,
          code: 'STRIPE_METADATA_INVALID',
          message: 'metadata.orderId fehlt oder ist ungültig.',
        });
      }
      if (!paymentIntentId) {
        throw new HttpError({
          status: 400,
          code: 'STRIPE_EVENT_INVALID',
          message: 'PaymentIntent id fehlt im Event.',
        });
      }

      await markOrderPaidByWebhook(orderId, paymentIntentId);
    }

    res.status(200).json({ received: true });
  }),
);

/**
 * IMPORTANT:
 * Provide default export as well, so app.js can import either:
 *   import stripeWebhooksRouter from './routes/webhooks.js'
 * OR
 *   import { stripeWebhooksRouter } from './routes/webhooks.js'
 */
export default stripeWebhooksRouter;
