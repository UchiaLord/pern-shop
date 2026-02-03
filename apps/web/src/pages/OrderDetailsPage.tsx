import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import type { OrderDetails } from '../lib/types';
import { EmptyState, ErrorBanner, Loading, OrderStatusBadge } from '../components/Status';

export default function OrderDetailsPage() {
  const { id } = useParams();
  const orderId = Number(id);

  const [data, setData] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.orders.get(orderId);
      setData(res);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setLoading(false);
      setData(null);
      return;
    }
    void reload();
  }, [orderId, reload]);

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return <EmptyState message="Ungültige Order-ID." />;
  }

  if (loading) return <Loading label="Lade Order..." />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return <EmptyState message="Order nicht gefunden." />;

  const { order, items } = data;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Order #{order.id}</h2>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void reload()} className="rounded-md border px-3 py-1 text-sm">
            Reload
          </button>
          <Link className="text-sm underline" to="/orders">
            Back
          </Link>
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <div className="text-sm opacity-80">
          Currency: {order.currency} · Subtotal: {order.subtotalCents} cents
        </div>
      </div>

      <h3 className="mt-6 mb-2 text-lg font-semibold">Items</h3>
      <div className="grid gap-2">
        {items.map((i) => (
          <div key={i.productId} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{i.name}</div>
                <div className="text-sm opacity-80">SKU: {i.sku}</div>
              </div>

              <div className="text-right text-sm">
                <div>
                  {i.quantity} × {i.unitPriceCents} cents
                </div>
                <div className="font-semibold">{i.lineTotalCents} cents</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}