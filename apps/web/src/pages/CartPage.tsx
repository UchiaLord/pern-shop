import { useEffect, useMemo, useState } from 'react';

import { EmptyState, ErrorBanner, Loading } from '../components/Status';
import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import type { Cart } from '../lib/types';

const EMPTY_CART: Cart = { items: [], subtotalCents: 0, currency: 'EUR' };

export default function CartPage() {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isRemoving, setIsRemoving] = useState<Record<number, boolean>>({});
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);

  async function loadCart() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.cart.get();
      setCart(res.cart);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCart();
  }, []);

  async function removeItem(productId: number) {
    if (isRemoving[productId]) return;

    setError(null);
    setIsRemoving((prev) => ({ ...prev, [productId]: true }));

    try {
      await api.cart.removeItem(productId);
      await loadCart();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsRemoving((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    }
  }

  async function checkout() {
    setError(null);
    setIsCheckingOut(true);

    try {
      await api.orders.checkout();
      await loadCart();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsCheckingOut(false);
    }
  }

  const isEmpty = cart.items.length === 0;

  const formattedSubtotal = useMemo(() => {
    return formatCents(cart.subtotalCents, cart.currency);
  }, [cart.subtotalCents, cart.currency]);

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
          const pending = Boolean(isRemoving[i.productId]) || isCheckingOut;

          return (
            <li key={i.productId} style={{ marginTop: 10, border: '1px solid #ddd', padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{i.name}</div>
                  <div style={{ opacity: 0.85 }}>
                    {formatCents(i.unitPriceCents, i.currency)} × {i.quantity} = {formatCents(i.lineTotalCents, i.currency)}
                  </div>
                </div>

                <div>
                  <button type="button" disabled={pending} onClick={() => void removeItem(i.productId)}>
                    {isRemoving[i.productId] ? 'Removing...' : 'Remove'}
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