// apps/web/src/pages/CartPage.tsx
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

export default function CartPage() {
  const nav = useNavigate();

  const [cart, setCart] = useState<Cart | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState<Record<number, boolean>>({});

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

  const isEmpty = !loading && !error && (cart?.items?.length ?? 0) === 0;

  const removeItem = useCallback(
    async (productId: number) => {
      if (mutating[productId]) return;

      setMutating((prev) => ({ ...prev, [productId]: true }));
      setError(null);

      try {
        const res = await api.cart.removeItem(productId);
        setCart(res.cart);
      } catch (err: unknown) {
        setError(extractErrorMessage(err));
        await reload();
      } finally {
        setMutating((prev) => {
          const copy = { ...prev };
          delete copy[productId];
          return copy;
        });
      }
    },
    [mutating, reload],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Cart</h2>
        <div className="flex gap-3">
          <Link className="underline" to="/products">
            Continue shopping
          </Link>
          <Button variant="ghost" onClick={reload} disabled={loading}>
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
          description="Add some products first."
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
                const isBusy = Boolean(mutating[it.productId]);

                return (
                  <div
                    key={it.productId}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3"
                  >
                    <div className="min-w-[220px]">
                      <div className="text-sm font-semibold">{name}</div>
                      <div className="text-xs opacity-75">
                        Qty: {it.quantity} · Unit: {formatCents(priceCents, cur)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold">{formatCents(line, cur)}</div>
                      <Button
                        variant="ghost"
                        onClick={() => void removeItem(it.productId)}
                        disabled={isBusy}
                        title="Remove item"
                      >
                        {isBusy ? 'Removing…' : 'Remove'}
                      </Button>
                    </div>
                  </div>
                );
              })}
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
              <Button
                className="w-full"
                onClick={() => nav('/checkout')}
                disabled={loading || (cart?.items?.length ?? 0) === 0}
              >
                Go to checkout
              </Button>

              <Link to="/products" className="block">
                <Button variant="ghost" className="w-full" disabled={loading}>
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
