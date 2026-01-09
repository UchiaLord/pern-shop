import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import type { Cart } from '../lib/types';


const EMPTY_CART: Cart = { items: [], subtotalCents: 0, currency: 'EUR' };

export default function CartPage() {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setError(null);
    try {
      const res = await api.cart.get();
      setCart(res.cart);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await api.cart.get();
        if (mounted) setCart(res.cart);
      } catch (err: unknown) {
        if (mounted) setError(extractErrorMessage(err));
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function checkout() {
    setError(null);
    try {
      await api.orders.checkout();
      await reload();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div>
      <h2>Cart</h2>
      {error && <div style={{ color: 'crimson' }}>{error}</div>}

      <button type="button" onClick={() => void reload()}>
        Reload
      </button>

      <ul>
        {cart.items.map((i) => (
          <li key={i.productId}>
            {i.name} x{i.quantity} — {i.lineTotalCents} {i.currency}
            <button
              type="button"
              style={{ marginLeft: 8 }}
              onClick={() => void api.cart.removeItem(i.productId).then(() => reload())}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div>
        <strong>Subtotal:</strong> {cart.subtotalCents} {cart.currency}
      </div>

      <button type="button" disabled={cart.items.length === 0} onClick={() => void checkout()}>
        Checkout
      </button>
    </div>
  );
}
