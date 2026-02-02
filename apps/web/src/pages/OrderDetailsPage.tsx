import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EmptyState, ErrorBanner, Loading } from '../components/Status';
import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import type { OrderDetails } from '../lib/types';

export default function OrderDetailsPage() {
  const params = useParams();
  const id = Number(params.id);

  const [data, setData] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isValidId = Number.isFinite(id) && id > 0;

  async function load() {
    if (!isValidId) {
      setError('Ungültige Order-ID.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.orders.get(id);
      setData(res);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const subtotal = useMemo(() => {
    if (!data) return null;
    return formatCents(data.order.subtotalCents, data.order.currency);
  }, [data]);

  return (
    <div>
      <h2>
        <Link to="/orders">Orders</Link> / Details
      </h2>

      {error ? <ErrorBanner message={error} /> : null}

      <button type="button" onClick={() => void load()} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Reload'}
      </button>

      {isLoading ? <Loading /> : null}

      {!isLoading && !error && !data ? <EmptyState message="Keine Daten." /> : null}

      {data ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ border: '1px solid #ddd', padding: 12 }}>
            <div style={{ fontWeight: 700 }}>Order #{data.order.id}</div>
            <div style={{ opacity: 0.85 }}>
              {subtotal} — {data.order.status}
            </div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>{data.order.createdAt}</div>
          </div>

          <h3 style={{ marginTop: 16 }}>Items</h3>

          {data.items.length === 0 ? <EmptyState message="Keine Items." /> : null}

          <ul style={{ listStyle: 'none', padding: 0 }}>
            {data.items.map((it) => (
              <li key={`${it.productId}-${it.sku}`} style={{ marginTop: 10, border: '1px solid #ddd', padding: 12 }}>
                <div style={{ fontWeight: 600 }}>{it.name}</div>
                <div style={{ opacity: 0.85 }}>
                  {formatCents(it.unitPriceCents, it.currency)} × {it.quantity} ={' '}
                  {formatCents(it.lineTotalCents, it.currency)}
                </div>
                <div style={{ opacity: 0.75, marginTop: 4 }}>SKU: {it.sku}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}