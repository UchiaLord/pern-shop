import { useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState, ErrorBanner, Loading } from '../components/Status';
import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import { useDebouncedCallback } from '../lib/useDebouncedCallback';
import type { Cart } from '../lib/types';

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

  const formattedSubtotal = useMemo(() => formatCents(cart.subtotalCents, cart.currency), [cart.subtotalCents, cart.currency]);

  return (
    <div>
      <h2>Cart</h2>

      {error ? <ErrorBanner message={error} /> : null}

      <button type="button" onClick={() => void loadCart()} disabled={isLoading || isCheckingOut}>
        {isLoading ? 'Loading...' : 'Reload'}
      </button>

      {isLoading ? <Loading /> : null}

      {!isLoading && !error && isEmpty ? <EmptyState message="Dein Warenkorb ist leer." /> : null}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {cart.items.map((i) => {
          const rowPending = Boolean(pending[i.productId]) || isCheckingOut;
          const draft = qtyDraft[i.productId] ?? String(i.quantity);

          return (
            <li key={i.productId} style={{ marginTop: 10, border: '1px solid #ddd', padding: 12, opacity: rowPending ? 0.75 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{i.name}</div>
                  <div style={{ opacity: 0.85 }}>
                    {formatCents(i.unitPriceCents, i.currency)} × {i.quantity} = {formatCents(i.lineTotalCents, i.currency)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" disabled={rowPending} onClick={() => onMinus(i.productId)}>
                    −
                  </button>

                  <input
                    value={draft}
                    onChange={(e) => onQtyInput(i.productId, e.target.value)}
                    onBlur={() => void onQtyBlur(i.productId)}
                    inputMode="numeric"
                    pattern="^\d+$"
                    style={{ width: 64, textAlign: 'center' }}
                    aria-label="Quantity"
                    disabled={rowPending}
                  />

                  <button type="button" disabled={rowPending} onClick={() => onPlus(i.productId)}>
                    +
                  </button>

                  <button type="button" disabled={rowPending} onClick={() => void removeItem(i.productId)}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div style={{ marginTop: 12 }}>
        <strong>Subtotal:</strong> {formattedSubtotal}
      </div>

      <button type="button" disabled={isEmpty || isCheckingOut || isLoading} onClick={() => void checkout()}>
        {isCheckingOut ? 'Checkout...' : 'Checkout'}
      </button>
    </div>
  );
}