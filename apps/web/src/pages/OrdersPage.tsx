import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import type { OrderSummary } from '../lib/types';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setError(null);
    try {
      const res = await api.orders.listMine();
      setOrders(res.orders);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await api.orders.listMine();
        if (mounted) setOrders(res.orders);
      } catch (err: unknown) {
        if (mounted) setError(extractErrorMessage(err));
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <h2>Orders</h2>
      {error && <div style={{ color: 'crimson' }}>{error}</div>}

      <button type="button" onClick={() => void reload()}>
        Reload
      </button>

      <ul>
        {orders.map((o) => (
          <li key={o.id}>
            Order #{o.id} — {o.subtotalCents} {o.currency} — {o.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
