// apps/web/src/pages/CheckoutPage.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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

export default function CheckoutPage() {
  const nav = useNavigate();

  const [cart, setCart] = useState<Cart | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);

  const reload = useCallback(async () => {
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
  }, []);

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

  const subtotalCents = useMemo(() => {
    return enriched.reduce((acc, it) => acc + calcLineTotalCents(it), 0);
  }, [enriched]);

  const currency = useMemo(() => {
    // Best-effort: take currency from first known product, fallback EUR
    const first = enriched.find((it) => it.product?.currency)?.product?.currency;
    return first ?? 'EUR';
  }, [enriched]);

  const isEmpty = !loading && !error && (cart?.items?.length ?? 0) === 0;

  const placeOrder = useCallback(async () => {
    if (placing) return;
    if (!cart || cart.items.length === 0) return;

    setPlacing(true);
    setError(null);

    try {
      const res = await api.orders.checkout();
      nav(`/orders/${res.order.id}`, { replace: true });
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setPlacing(false);
    }
  }, [cart, nav, placing]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Checkout</h2>
        <div className="flex gap-3">
          <Link className="underline" to="/cart">
            Back to cart
          </Link>
          <Button variant="ghost" onClick={reload} disabled={loading || placing}>
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

      {!loading && !error && enriched.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-2">
            <div className="mb-3 text-sm font-semibold">Items</div>

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

            <div className="mt-4 text-xs opacity-70">
              Hinweis: Dieser Checkout ist bewusst minimal (Day 29). Payment kommt als nächstes.
            </div>
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
              <Button className="w-full" onClick={placeOrder} disabled={placing || loading}>
                {placing ? 'Placing…' : 'Place order'}
              </Button>

              <Link to="/products" className="block">
                <Button variant="ghost" className="w-full" disabled={placing || loading}>
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
