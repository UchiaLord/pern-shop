import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import type { OrderDetails } from '../lib/types';
import { EmptyState, ErrorBanner, Loading, OrderStatusBadge } from '../components/Status';
import { getOrderStatusActions, type OrderStatus } from '../lib/orderStatus';

type OrderDetailsWithTimestamps = OrderDetails & {
  order: OrderDetails['order'] & {
    paidAt?: string | null;
    shippedAt?: string | null;
    completedAt?: string | null;
    updatedAt?: string | null;
  };
};

function fmtMaybeIso(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function AdminOrderDetailsPage() {
  const { id } = useParams();
  const orderId = Number(id);

  const [data, setData] = useState<OrderDetailsWithTimestamps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function reload() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.adminOrders.get(orderId);
      setData(res as OrderDetailsWithTimestamps);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setLoading(false);
      setData(null);
      return;
    }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const currentStatus = (data?.order.status ?? 'pending') as OrderStatus;

  const actions = useMemo(() => getOrderStatusActions(currentStatus), [currentStatus]);

  async function applyStatus(next: OrderStatus) {
    if (!data) return;
    setActionError(null);
    setBusy(true);
    try {
      await api.adminOrders.setStatus(orderId, next);
      await reload();
    } catch (err: unknown) {
      setActionError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onAction(next: OrderStatus) {
    const action = actions.find((a) => a.nextStatus === next);

    if (action?.confirm) {
      const ok = window.confirm(action.confirm.message);
      if (!ok) return;
    }

    void applyStatus(next);
  }

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
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-md border px-3 py-1 text-sm"
            disabled={busy}
          >
            Reload
          </button>
          <Link className="text-sm underline" to="/admin/orders">
            Back
          </Link>
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <div className="text-sm opacity-80">
          Currency: {order.currency} · Subtotal: {order.subtotalCents} cents
        </div>

        <div className="mt-3 grid gap-1 text-sm">
          <div className="opacity-80">
            <span className="font-medium">Updated:</span> {fmtMaybeIso(order.updatedAt)}
          </div>
          <div className="opacity-80">
            <span className="font-medium">Paid:</span> {fmtMaybeIso(order.paidAt)}
          </div>
          <div className="opacity-80">
            <span className="font-medium">Shipped:</span> {fmtMaybeIso(order.shippedAt)}
          </div>
          <div className="opacity-80">
            <span className="font-medium">Completed:</span> {fmtMaybeIso(order.completedAt)}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium">Aktionen:</div>

          {actions.length === 0 ? (
            <div className="text-sm opacity-70">Keine weiteren Transitions möglich.</div>
          ) : (
            <>
              {actions.map((a) => {
                const base = 'rounded-md border px-3 py-1 text-sm';
                const danger = a.variant === 'danger' ? ' border-red-500/60 text-red-300' : '';
                const cls = base + danger;

                return (
                  <button
                    key={a.nextStatus}
                    type="button"
                    onClick={() => onAction(a.nextStatus)}
                    className={cls}
                    disabled={busy}
                  >
                    {a.label}
                  </button>
                );
              })}

              {busy ? <div className="text-sm opacity-70">Updating…</div> : null}
              {actionError ? <div className="text-sm text-red-400">{actionError}</div> : null}
            </>
          )}
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