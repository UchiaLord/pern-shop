// apps/api/src/routes/payments.js
import express from 'express';
import Stripe from 'stripe';

import { requireAuth } from '../middleware/require-auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../errors/http-error.js';
import {
  createOrderFromCart,
  attachPaymentIntentToOrder,
  getOrderForPaymentReuseByUser,
} from '../db/repositories/order-repository.js';

export const paymentsRouter = express.Router();

function stripeEnabled() {
  // Day 31: allow Stripe flow in test as well when STRIPE_SECRET_KEY is provided.
  // This enables deterministic unit tests with mocked Stripe SDK.
  return Boolean(process.env.STRIPE_SECRET_KEY);
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

function stableCartKey(items) {
  const normalized = (Array.isArray(items) ? items : [])
    .map((it) => ({
      productId: Number(it?.productId),
      quantity: Number(it?.quantity),
    }))
    .filter(
      (it) =>
        Number.isFinite(it.productId) &&
        it.productId > 0 &&
        Number.isFinite(it.quantity) &&
        it.quantity > 0,
    )
    .sort((a, b) => a.productId - b.productId);

  return JSON.stringify(normalized);
}

async function tryReuseExistingCheckout({ req, userId }) {
  const rememberedOrderId = req.session?.checkout?.orderId ?? null;
  if (!rememberedOrderId) return null;

  const existing = await getOrderForPaymentReuseByUser(userId, rememberedOrderId);
  if (!existing || existing.status !== 'pending' || !existing.paymentIntentId) return null;

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(existing.paymentIntentId);
  const clientSecret = pi?.client_secret ?? null;

  if (!clientSecret) return null;

  return { orderId: existing.id, clientSecret };
}

/**
 * POST /payments/create-intent
 *
 * Day 31 Hardening:
 * - Session-based idempotency:
 *   - If cart is empty (already cleared), reuse existing pending order+PI (200).
 *   - If cart is present, reuse only when snapshot matches checkout.cartKey (200).
 *   - If cart snapshot differs, create a NEW order+PI (201) and overwrite checkout marker.
 * - Stripe idempotencyKey: order_<orderId>
 */
paymentsRouter.post(
  '/create-intent',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!stripeEnabled()) {
      throw new HttpError({
        status: 400,
        code: 'STRIPE_DISABLED',
        message: 'Stripe ist nicht aktiv (STRIPE_SECRET_KEY fehlt).',
      });
    }

    const userId = req.session?.user?.id;
    if (!userId) {
      throw new HttpError({ status: 401, code: 'UNAUTHORIZED', message: 'Nicht eingeloggt.' });
    }

    if (!req.session.checkout) req.session.checkout = {};

    const items = req.session?.cart?.items ?? [];
    const hasCartItems = Array.isArray(items) && items.length > 0;

    // ---- Case A: Cart is present -> reuse ONLY if snapshot matches ----
    if (hasCartItems) {
      const cartKey = stableCartKey(items);
      const prevKey = req.session.checkout.cartKey ?? null;
      const prevOrderId = req.session.checkout.orderId ?? null;

      if (prevOrderId && prevKey && prevKey === cartKey) {
        const reused = await tryReuseExistingCheckout({ req, userId });
        if (reused) return res.status(200).json(reused);

        // If reuse fails, clear marker and proceed to create new
        req.session.checkout = {};
      } else if (prevOrderId && prevKey && prevKey !== cartKey) {
        // Cart changed -> treat as NEW checkout
        req.session.checkout = {};
      }

      // Fresh checkout path below will create a new order+PI (201)
    } else {
      // ---- Case B: Cart is empty -> allow reuse (double-click / retry) ----
      const reused = await tryReuseExistingCheckout({ req, userId });
      if (reused) return res.status(200).json(reused);

      // No cart, no reusable checkout -> error
      throw new HttpError({
        status: 400,
        code: 'CART_EMPTY',
        message: 'Warenkorb ist leer.',
      });
    }

    // ---- Fresh checkout path (requires cart items) ----
    if (!hasCartItems) {
      throw new HttpError({
        status: 400,
        code: 'CART_EMPTY',
        message: 'Warenkorb ist leer.',
      });
    }

    const cartKey = stableCartKey(items);

    // 1) Create order (freezes prices)
    const created = await createOrderFromCart(userId, items);

    // 2) Clear cart (idempotent)
    if (req.session?.cart) {
      req.session.cart.items = [];
    }

    const orderId = created.order.id;

    // 3) Create PaymentIntent with Stripe idempotency key (order-scoped)
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.create(
      {
        amount: Number(created.order.subtotalCents),
        currency: String(created.order.currency ?? 'EUR').toLowerCase(),
        metadata: {
          orderId: String(orderId),
          userId: String(userId),
        },
        automatic_payment_methods: { enabled: true },
      },
      {
        idempotencyKey: `order_${orderId}`,
      },
    );

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

    // 5) Persist checkout marker for retries
    req.session.checkout = {
      cartKey,
      orderId,
    };

    res.status(201).json({ orderId, clientSecret });
  }),
);

// same reason as webhooks: robust against default-import usage
export default paymentsRouter;
