// apps/api/src/routes/webhooks.js
import express from 'express';
import Stripe from 'stripe';

import { HttpError } from '../errors/http-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  markOrderPaidByWebhook,
  markOrderCancelledByWebhook,
} from '../db/repositories/order-repository.js';

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

function logWebhook(info) {
  // Structured logging (Day 31 MVP: no DB migration)
 
  console.log(
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        source: 'stripe-webhook',
        ...info,
      },
      null,
      0,
    ),
  );
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
      logWebhook({
        ok: false,
        stage: 'constructEvent',
        error: e?.message ?? String(e),
      });
      throw new HttpError({
        status: 400,
        code: 'STRIPE_SIGNATURE_INVALID',
        message: 'Ungültige Stripe Signatur.',
        details: { reason: e?.message ?? String(e) },
      });
    }

    const type = event?.type ?? 'unknown';
    const eventId = event?.id ?? null;

    // For PaymentIntent events, Stripe sends the PI object as data.object
    const obj = event?.data?.object ?? null;
    const paymentIntentId = obj?.id ?? null;
    const orderIdRaw = obj?.metadata?.orderId ?? null;
    const orderId = Number(orderIdRaw);

    logWebhook({
      ok: true,
      stage: 'received',
      eventId,
      type,
      paymentIntentId,
      orderId: Number.isFinite(orderId) ? orderId : null,
    });

    // Only handle PaymentIntent-based events we care about
    const isHandledType =
      type === 'payment_intent.succeeded' ||
      type === 'payment_intent.payment_failed' ||
      type === 'payment_intent.canceled';

    if (isHandledType) {
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
    }

    if (type === 'payment_intent.succeeded') {
      await markOrderPaidByWebhook(orderId, paymentIntentId);

      logWebhook({
        ok: true,
        stage: 'processed',
        eventId,
        type,
        paymentIntentId,
        orderId,
        result: 'marked_paid',
      });
    }

    if (type === 'payment_intent.payment_failed') {
      const reason =
        obj?.last_payment_error?.message ??
        obj?.last_payment_error?.code ??
        'payment_failed';

      await markOrderCancelledByWebhook(orderId, paymentIntentId, {
        reason: String(reason),
        source: 'payment_intent.payment_failed',
      });

      logWebhook({
        ok: true,
        stage: 'processed',
        eventId,
        type,
        paymentIntentId,
        orderId,
        result: 'marked_cancelled',
        reason: String(reason),
      });
    }

    if (type === 'payment_intent.canceled') {
      const reason = obj?.cancellation_reason ?? 'canceled';

      await markOrderCancelledByWebhook(orderId, paymentIntentId, {
        reason: String(reason),
        source: 'payment_intent.canceled',
      });

      logWebhook({
        ok: true,
        stage: 'processed',
        eventId,
        type,
        paymentIntentId,
        orderId,
        result: 'marked_cancelled',
        reason: String(reason),
      });
    }

    // Always return 200 to Stripe if we handled/ignored successfully.
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
