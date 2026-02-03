import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import type { OrderSummary } from '../lib/types';
import { EmptyState, ErrorBanner, Loading, OrderStatusBadge } from '../components/Status';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.adminOrders.list();
      setOrders(res.orders);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  if (loading) return <Loading label="Lade Admin Orders..." />;
  if (error) return <ErrorBanner message={error} />;
  if (orders.length === 0) return <EmptyState message="Keine Bestellungen vorhanden." />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Admin Orders</h2>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-md border px-3 py-1 text-sm"
        >
          Reload
        </button>
      </div>

      <div className="grid gap-3">
        {orders.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <strong className="truncate">Order #{o.id}</strong>
                <OrderStatusBadge status={o.status} />
              </div>
              <div className="mt-1 text-sm opacity-80">
                {o.currency} · Subtotal: {o.subtotalCents} cents
              </div>
            </div>

            <Link className="text-sm underline" to={`/admin/orders/${o.id}`}>
              Details
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}