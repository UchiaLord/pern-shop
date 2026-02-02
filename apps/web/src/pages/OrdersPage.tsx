import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState, ErrorBanner, Loading } from '../components/Status';
import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import type { OrderSummary } from '../lib/types';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const copy = [...orders];
    // newest first if createdAt is ISO string
    copy.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return copy;
  }, [orders]);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.orders.listMine();
      setOrders(res.orders);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <h2>Orders</h2>

      {error ? <ErrorBanner message={error} /> : null}

      <button type="button" onClick={() => void load()} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Reload'}
      </button>

      {isLoading ? <Loading /> : null}

      {!isLoading && !error && sorted.length === 0 ? <EmptyState message="Keine Bestellungen." /> : null}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {sorted.map((o) => (
          <li key={o.id} style={{ marginTop: 10, border: '1px solid #ddd', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  <Link to={`/orders/${o.id}`}>Order #{o.id}</Link>
                </div>
                <div style={{ opacity: 0.85 }}>
                  {formatCents(o.subtotalCents, o.currency)} — {o.status}
                </div>
                <div style={{ opacity: 0.75, marginTop: 4 }}>{o.createdAt}</div>
              </div>

              <div>
                <Link to={`/orders/${o.id}`}>Details</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}