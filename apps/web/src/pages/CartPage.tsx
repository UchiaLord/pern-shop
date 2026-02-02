import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ErrorBanner, Loading } from '../components/Status';
import EmptyState from '../components/ui/EmptyState';

import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import { useDebouncedCallback } from '../lib/useDebouncedCallback';
import type { Cart } from '../lib/types';

import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

const EMPTY_CART: Cart = { items: [], subtotalCents: 0, currency: 'EUR' };

type QtyDraftMap = Record<number, string>; // productId -> string (for input)

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseQtyDraft(raw: string): number | null {
  const t = raw.trim();
  if (t.length === 0) return null;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

export default function CartPage() {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Track in-flight operations per product row
  const [pending, setPending] = useState<Record<number, boolean>>({});

  // Quantity draft per item (controlled input)
  const [qtyDraft, setQtyDraft] = useState<QtyDraftMap>({});

  // Keep latest cart in ref for debounced sync
  const cartRef = useRef<Cart>(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  async function loadCart() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.cart.get();
      setCart(res.cart);

      // initialize qty drafts from server
      const drafts: QtyDraftMap = {};
      for (const it of res.cart.items) drafts[it.productId] = String(it.quantity);
      setQtyDraft(drafts);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCart();
  }, []);

  const { debounced: debouncedSyncQty, flush: flushSyncQty, cancel: cancelSyncQty } = useDebouncedCallback(
    async (productId: number, qty: number) => {
      // Server contract:
      // - POST /cart/items { productId, quantity } upsert
      // - DELETE /cart/items/:productId remove
      try {
        setPending((p) => ({ ...p, [productId]: true }));
        setError(null);

        if (qty <= 0) {
          await api.cart.removeItem(productId);
        } else {
          await api.cart.upsertItem(productId, qty);
        }

        // refresh for canonical totals (avoid drift)
        const res = await api.cart.get();
        setCart(res.cart);

        const drafts: QtyDraftMap = {};
        for (const it of res.cart.items) drafts[it.productId] = String(it.quantity);
        setQtyDraft(drafts);
      } catch (err: unknown) {
        setError(extractErrorMessage(err));
        // best-effort refresh on failure
        await loadCart();
      } finally {
        setPending((p) => {
          const copy = { ...p };
          delete copy[productId];
          return copy;
        });
      }
    },
    450,
  );

  async function removeItem(productId: number) {
    if (pending[productId]) return;

    // cancel pending debounced changes for this row by flushing a "remove"
    // (flush executes immediately; we want immediate delete)
    await flushSyncQty(productId, 0);
  }

  function setQtyOptimistic(productId: number, nextQty: number) {
    // Update cart items optimistically
    setCart((prev) => {
      const items = prev.items.map((it) => {
        if (it.productId !== productId) return it;

        const unit = it.unitPriceCents;
        const qty = nextQty;
        const lineTotalCents = unit * qty;

        return { ...it, quantity: qty, lineTotalCents };
      });

      // recompute subtotal from items
      const subtotalCents = items.reduce((sum, it) => sum + it.lineTotalCents, 0);
      return { ...prev, items, subtotalCents };
    });

    // Update draft value
    setQtyDraft((prev) => ({ ...prev, [productId]: String(nextQty) }));
  }

  function onPlus(productId: number) {
    const item = cart.items.find((it) => it.productId === productId);
    if (!item) return;
    if (pending[productId]) return;

    const nextQty = clampInt(item.quantity + 1, 1, 999);
    setQtyOptimistic(productId, nextQty);
    debouncedSyncQty(productId, nextQty);
  }

  function onMinus(productId: number) {
    const item = cart.items.find((it) => it.productId === productId);
    if (!item) return;
    if (pending[productId]) return;

    const nextQty = clampInt(item.quantity - 1, 0, 999);
    if (nextQty === 0) {
      // remove immediately (not debounced; users expect instant remove)
      void removeItem(productId);
      return;
    }

    setQtyOptimistic(productId, nextQty);
    debouncedSyncQty(productId, nextQty);
  }

  function onQtyInput(productId: number, raw: string) {
    if (pending[productId]) return;

    // allow empty while typing
    setQtyDraft((prev) => ({ ...prev, [productId]: raw }));

    const parsed = parseQtyDraft(raw);
    if (parsed === null) {
      // don’t sync until valid
      return;
    }

    const nextQty = clampInt(parsed, 0, 999);

    // optimistic update if item exists
    const item = cartRef.current.items.find((it) => it.productId === productId);
    if (!item) return;

    if (nextQty === 0) {
      // remove immediately
      void removeItem(productId);
      return;
    }

    setQtyOptimistic(productId, nextQty);
    debouncedSyncQty(productId, nextQty);
  }

  async function onQtyBlur(productId: number) {
    if (pending[productId]) return;

    const raw = qtyDraft[productId] ?? '';
    const parsed = parseQtyDraft(raw);

    const item = cartRef.current.items.find((it) => it.productId === productId);
    if (!item) return;

    // If invalid/empty -> snap back to server-known quantity
    if (parsed === null) {
      setQtyDraft((prev) => ({ ...prev, [productId]: String(item.quantity) }));
      return;
    }

    const nextQty = clampInt(parsed, 0, 999);

    // Force a sync on blur to avoid leaving stale debounced updates
    if (nextQty === 0) {
      await removeItem(productId);
      return;
    }

    await flushSyncQty(productId, nextQty);
  }

  async function checkout() {
    // ensure debounced ops don't race checkout
    cancelSyncQty();

    setError(null);
    setPending((prev) => ({ ...prev, __checkout__: true } as unknown as Record<number, boolean>));

    try {
      await api.orders.checkout();
      await loadCart();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setPending((prev) => {
        const copy = { ...prev };
        delete (copy as unknown as Record<string, boolean>).__checkout__;
        return copy;
      });
    }
  }

  const isEmpty = cart.items.length === 0;
  const isCheckingOut = Boolean((pending as unknown as Record<string, boolean>).__checkout__);

  const formattedSubtotal = useMemo(
    () => formatCents(cart.subtotalCents, cart.currency),
    [cart.subtotalCents, cart.currency],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs tracking-widest text-[rgb(var(--muted))]">CHECKOUT</div>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--fg))]">Cart</h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Quantity updates are debounced; checkout flushes pending changes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void loadCart()} disabled={isLoading || isCheckingOut}>
            {isLoading ? 'Loading…' : 'Reload'}
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {isLoading ? <Loading /> : null}

      {!isLoading && !error && isEmpty ? (
        <EmptyState
          title="Dein Warenkorb ist leer"
          description="Füge Produkte hinzu, um zur Kasse zu gehen."
          action={
            <Link to="/products">
              <Button>Produkte entdecken</Button>
            </Link>
          }
        />
      ) : null}

      {!isLoading && !error && !isEmpty ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Items */}
          <div className="space-y-4 lg:col-span-2">
            {cart.items.map((i) => {
              const rowPending = Boolean(pending[i.productId]) || isCheckingOut;
              const draft = qtyDraft[i.productId] ?? String(i.quantity);

              return (
                <Card key={i.productId} className={rowPending ? 'opacity-80' : ''}>
                  <CardHeader className="space-y-1">
                    <CardTitle className="flex items-start justify-between gap-3">
                      <span className="leading-tight">{i.name}</span>
                      <span className="rounded-2xl border border-white/10 bg-white/6 px-2 py-1 text-xs text-[rgb(var(--muted))]">
                        #{i.productId}
                      </span>
                    </CardTitle>

                    <div className="text-sm text-[rgb(var(--muted))]">
                      {formatCents(i.unitPriceCents, i.currency)} × {i.quantity} ={' '}
                      <span className="text-[rgb(var(--fg))]/90">{formatCents(i.lineTotalCents, i.currency)}</span>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        disabled={rowPending}
                        onClick={() => onMinus(i.productId)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </Button>

                      <Input
                        value={draft}
                        onChange={(e) => onQtyInput(i.productId, e.target.value)}
                        onBlur={() => void onQtyBlur(i.productId)}
                        inputMode="numeric"
                        pattern="^\\d+$"
                        aria-label="Quantity"
                        disabled={rowPending}
                        className="w-20 text-center"
                      />

                      <Button
                        variant="ghost"
                        disabled={rowPending}
                        onClick={() => onPlus(i.productId)}
                        aria-label="Increase quantity"
                      >
                        +
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="danger" disabled={rowPending} onClick={() => void removeItem(i.productId)}>
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">Subtotal</span>
                  <span className="text-[rgb(var(--fg))]/90">{formattedSubtotal}</span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-xs text-[rgb(var(--muted))]">
                  Shipping & taxes are not implemented yet. Next step: Stripe PaymentIntent + webhook-confirmed orders.
                </div>

                <Button className="w-full" disabled={isEmpty || isCheckingOut || isLoading} onClick={() => void checkout()}>
                  {isCheckingOut ? 'Checkout…' : 'Checkout'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}