// apps/api/src/services/stripe.js
import Stripe from 'stripe';

import { HttpError } from '../errors/http-error.js';

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

export function isStripeEnabled() {
  return Boolean((process.env.STRIPE_SECRET_KEY ?? '').trim());
}

export async function stripeCreateCatalogProduct({ sku, name, description, currency, priceCents, active }) {
  const stripe = getStripe();

  const product = await stripe.products.create({
    name,
    description: description ?? undefined,
    active: Boolean(active),
    metadata: {
      sku: String(sku),
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Number(priceCents),
    currency: String(currency).toLowerCase(),
  });

  // set default_price for product
  await stripe.products.update(product.id, { default_price: price.id });

  return { stripeProductId: product.id, stripePriceId: price.id };
}

export async function stripeUpdateCatalogProduct({ stripeProductId, name, description, active }) {
  const stripe = getStripe();

  await stripe.products.update(stripeProductId, {
    name: name ?? undefined,
    description: description ?? undefined,
    active: active === undefined ? undefined : Boolean(active),
  });
}

export async function stripeCreateNewPriceAndSetDefault({ stripeProductId, currency, priceCents }) {
  const stripe = getStripe();

  const price = await stripe.prices.create({
    product: stripeProductId,
    unit_amount: Number(priceCents),
    currency: String(currency).toLowerCase(),
  });

  await stripe.products.update(stripeProductId, { default_price: price.id });

  return { stripePriceId: price.id };
}
