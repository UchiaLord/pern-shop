// apps/web/src/pages/CheckoutPage.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import type { Cart, Product } from '../lib/types';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

type EnrichedItem = {
  productId: number;
  quantity: number;
  product?: Product;
};

function calcLineTotalCents(item: EnrichedItem): number {
  const price = item.product?.priceCents ?? 0;
  return price * item.quantity;
}

const stripePromise: Promise<Stripe | null> = (() => {
  const pk = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ?? '';
  return pk ? loadStripe(pk) : Promise.resolve(null);
})();

function StripeCheckoutForm(props: { orderId: number; onError: (msg: string) => void }) {
  const { orderId, onError } = props;
  const nav = useNavigate();

  const stripe = useStripe();
  const elements = useElements();

  const [confirming, setConfirming] = useState(false);

  const confirm = useCallback(async () => {
    if (confirming) return;
    if (!stripe || !elements) return;

    setConfirming(true);
    onError('');

    try {
      const returnUrl = `${window.location.origin}/orders/${orderId}`;

      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required',
      });

      if (result.error) {
        onError(result.error.message ?? 'Payment confirmation failed.');
        return;
      }

      // No redirect required -> we can navigate directly
      nav(`/orders/${orderId}`, { replace: true });
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setConfirming(false);
    }
  }, [confirming, elements, nav, onError, orderId, stripe]);

  return (
    <div className="space-y-3">
      <PaymentElement />

      <Button className="w-full" onClick={confirm} disabled={!stripe || !elements || confirming}>
        {confirming ? 'Confirming…' : 'Pay now'}
      </Button>

      <div className="text-xs opacity-70">
        Hinweis: Bei manchen Payment-Methods erfolgt ein Redirect (3DS). Danach landest du automatisch bei der Order.
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const nav = useNavigate();

  const [cart, setCart] = useState<Cart | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  // Stripe intent state
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);

  const showStripe = Boolean(clientSecret && orderId);

  const reload = useCallback(async () => {
    // Wenn bereits ein Intent läuft/steht, nur gezielt per Reset neu laden.
    if (showStripe) return;

    setLoading(true);
    setError(null);

    try {
      const [cartRes, productsRes] = await Promise.all([api.cart.get(), api.products.list()]);
      setCart(cartRes.cart);
      setProducts(productsRes.products);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
      setCart(null);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [showStripe]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const enriched: EnrichedItem[] = useMemo(() => {
    const map = new Map<number, Product>(products.map((p) => [p.id, p]));
    const items = cart?.items ?? [];
    return items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      product: map.get(it.productId),
    }));
  }, [cart, products]);

  const computedSubtotalCents = useMemo(() => {
    return enriched.reduce((acc, it) => acc + calcLineTotalCents(it), 0);
  }, [enriched]);

  const currency = useMemo(() => {
    const fromCart = cart?.currency;
    if (fromCart && fromCart.trim().length === 3) return fromCart;

    const first = enriched.find((it) => it.product?.currency)?.product?.currency;
    return first ?? 'EUR';
  }, [cart?.currency, enriched]);

  const subtotalCents = useMemo(() => {
    const fromCart = cart?.subtotalCents;
    if (typeof fromCart === 'number' && Number.isFinite(fromCart)) return fromCart;
    return computedSubtotalCents;
  }, [cart?.subtotalCents, computedSubtotalCents]);

  const isEmpty = !loading && !error && !showStripe && (cart?.items?.length ?? 0) === 0;

  const resetPayment = useCallback(() => {
    setClientSecret(null);
    setOrderId(null);
    setError(null);
  }, []);

  const startPayment = useCallback(async () => {
    if (creatingIntent) return;
    if (!cart || cart.items.length === 0) return;
    if (showStripe) return;

    setCreatingIntent(true);
    setError(null);

    try {
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error(
          'Stripe ist im Frontend nicht konfiguriert (VITE_STRIPE_PUBLISHABLE_KEY fehlt).',
        );
      }

      const res = await api.payments.createIntent();
      setOrderId(res.orderId);
      setClientSecret(res.clientSecret);

      // Backend leert Cart serverseitig -> UI sofort synchronisieren
      const freshCart = await api.cart.get().catch(() => null);
      if (freshCart?.cart) setCart(freshCart.cart);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setCreatingIntent(false);
    }
  }, [cart, creatingIntent, showStripe]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Checkout</h2>
        <div className="flex gap-3">
          <Link className="underline" to="/cart">
            Back to cart
          </Link>
          <Button variant="ghost" onClick={reload} disabled={loading || creatingIntent || showStripe}>
            {loading ? 'Loading…' : 'Reload'}
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <div className="text-sm text-red-600">{error}</div>
        </Card>
      ) : null}

      {loading ? (
        <Card className="p-4">
          <div className="text-sm">Loading…</div>
        </Card>
      ) : null}

      {isEmpty ? (
        <EmptyState
          title="Cart is empty"
          description="Add some products first, then come back to checkout."
          action={
            <Link to="/products">
              <Button>Browse products</Button>
            </Link>
          }
        />
      ) : null}

      {!loading && !error && (enriched.length > 0 || showStripe) ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-2">
            <div className="mb-3 text-sm font-semibold">Items</div>

            {enriched.length > 0 ? (
              <div className="space-y-3">
                {enriched.map((it) => {
                  const name = it.product?.name ?? `Product #${it.productId}`;
                  const priceCents = it.product?.priceCents ?? 0;
                  const line = calcLineTotalCents(it);
                  const cur = it.product?.currency ?? currency;

                  return (
                    <div
                      key={it.productId}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3"
                    >
                      <div className="min-w-[220px]">
                        <div className="text-sm font-semibold">{name}</div>
                        <div className="text-xs opacity-75">
                          Qty: {it.quantity} · Unit: {formatCents(priceCents, cur)}
                        </div>
                      </div>

                      <div className="text-sm font-semibold">{formatCents(line, cur)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm opacity-75">
                Cart wurde serverseitig geleert (Order/Payment gestartet). Die Payment-Details sind unten.
              </div>
            )}

            {showStripe ? (
              <div className="mt-4">
                <div className="mb-2 text-sm font-semibold">Payment</div>

                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret: clientSecret ?? undefined,
                  }}
                >
                  <StripeCheckoutForm
                    orderId={orderId as number}
                    onError={(msg) => setError(msg || null)}
                  />
                </Elements>

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      resetPayment();
                      nav('/cart');
                    }}
                  >
                    Cancel payment
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      resetPayment();
                      void reload();
                    }}
                  >
                    Reset intent
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-xs opacity-70">
                Hinweis: PaymentIntent wird erst erstellt, wenn du „Continue to payment“ klickst.
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-3 text-sm font-semibold">Summary</div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="opacity-80">Subtotal</span>
                <span className="font-semibold">{formatCents(subtotalCents, currency)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="opacity-80">Shipping</span>
                <span className="font-semibold">{formatCents(0, currency)}</span>
              </div>

              <div className="my-2 border-t border-white/10 pt-2 flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-base font-semibold">{formatCents(subtotalCents, currency)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {!showStripe ? (
                <Button
                  className="w-full"
                  onClick={startPayment}
                  disabled={creatingIntent || loading || (cart?.items?.length ?? 0) === 0}
                >
                  {creatingIntent ? 'Creating payment…' : 'Continue to payment'}
                </Button>
              ) : (
                <Button className="w-full" disabled>
                  Payment started (see left)
                </Button>
              )}

              <Link to="/products" className="block">
                <Button variant="ghost" className="w-full" disabled={creatingIntent || loading}>
                  Continue shopping
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
