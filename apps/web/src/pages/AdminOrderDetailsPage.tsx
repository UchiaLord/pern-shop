import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import type { OrderDetails } from '../lib/types';
import { EmptyState, ErrorBanner, Loading, OrderStatusBadge } from '../components/Status';
import {
  ORDER_STATUS_LABEL,
  allowedNextStatuses,
  isTerminalStatus,
  type OrderStatus,
} from '../lib/orderStatus';

function fmtMaybeIso(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function statusIndex(s: OrderStatus) {
  // Cancelled ist terminal “side path”
  if (s === 'cancelled') return -1;
  if (s === 'pending') return 0;
  if (s === 'paid') return 1;
  if (s === 'shipped') return 2;
  return 3; // completed
}

type Step = {
  key: OrderStatus;
  title: string;
  time?: string | null | undefined;
};

export default function AdminOrderDetailsPage() {
  const { id } = useParams();
  const orderId = Number(id);

  const [data, setData] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function reload() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.adminOrders.get(orderId);
      setData(res as OrderDetails);
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
  const nextOptions = useMemo(() => allowedNextStatuses(currentStatus), [currentStatus]);

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

  function onCancel() {
    const ok = window.confirm(
      'Order wirklich stornieren?\n\nDas setzt den Status auf "cancelled". Danach sind keine weiteren Transitions mehr möglich.',
    );
    if (!ok) return;
    void applyStatus('cancelled');
  }

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return <EmptyState message="Ungültige Order-ID." />;
  }

  if (loading) return <Loading label="Lade Order..." />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return <EmptyState message="Order nicht gefunden." />;

  const { order, items } = data;

  const canPaid = nextOptions.includes('paid');
  const canShipped = nextOptions.includes('shipped');
  const canCompleted = nextOptions.includes('completed');
  const canCancelled = nextOptions.includes('cancelled');

  const curIdx = statusIndex(currentStatus);

  const steps: Step[] = [
    { key: 'pending', title: ORDER_STATUS_LABEL.pending, time: order.createdAt },
    { key: 'paid', title: ORDER_STATUS_LABEL.paid, time: order.paidAt },
    { key: 'shipped', title: ORDER_STATUS_LABEL.shipped, time: order.shippedAt },
    { key: 'completed', title: ORDER_STATUS_LABEL.completed, time: order.completedAt },
  ];

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

        {/* B1.3 Timeline */}
        <div className="mt-4 rounded-lg border p-3">
          <div className="mb-2 text-sm font-medium">Status Timeline</div>

          {currentStatus === 'cancelled' ? (
            <div className="text-sm">
              <div className="mb-2">
                <OrderStatusBadge status="cancelled" /> <span className="ml-2">{ORDER_STATUS_LABEL.cancelled}</span>
              </div>
              <div className="opacity-80">
                Die Order wurde storniert. Weitere Transitions sind nicht möglich.
              </div>
            </div>
          ) : (
            <ol className="grid gap-2">
              {steps.map((s) => {
                const idx = statusIndex(s.key);
                const done = idx <= curIdx;
                const isCurrent = idx === curIdx && !isTerminalStatus(currentStatus);

                const dotBase = 'h-3 w-3 rounded-full border';
                const dot = done ? `${dotBase} bg-white` : `${dotBase} bg-transparent opacity-40`;
                const row = done ? '' : 'opacity-60';

                return (
                  <li key={s.key} className={`flex items-start gap-3 ${row}`}>
                    <div className="mt-1 flex flex-col items-center">
                      <div className={dot} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">{s.title}</div>
                        {isCurrent ? <span className="text-xs opacity-70">(current)</span> : null}
                        {done ? <OrderStatusBadge status={s.key} /> : null}
                      </div>
                      <div className="mt-0.5 text-xs opacity-70">
                        {s.key === 'pending' ? fmtMaybeIso(order.createdAt) : fmtMaybeIso(s.time)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium">Aktionen:</div>

          {nextOptions.length === 0 ? (
            <div className="text-sm opacity-70">Keine weiteren Transitions möglich.</div>
          ) : (
            <>
              {canPaid ? (
                <button
                  type="button"
                  onClick={() => void applyStatus('paid')}
                  className="rounded-md border px-3 py-1 text-sm"
                  disabled={busy}
                  title={ORDER_STATUS_LABEL.paid}
                >
                  Mark as paid
                </button>
              ) : null}

              {canShipped ? (
                <button
                  type="button"
                  onClick={() => void applyStatus('shipped')}
                  className="rounded-md border px-3 py-1 text-sm"
                  disabled={busy}
                  title={ORDER_STATUS_LABEL.shipped}
                >
                  Mark as shipped
                </button>
              ) : null}

              {canCompleted ? (
                <button
                  type="button"
                  onClick={() => void applyStatus('completed')}
                  className="rounded-md border px-3 py-1 text-sm"
                  disabled={busy}
                  title={ORDER_STATUS_LABEL.completed}
                >
                  Mark as completed
                </button>
              ) : null}

              {canCancelled ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-md border border-red-500/60 px-3 py-1 text-sm text-red-300"
                  disabled={busy}
                  title={ORDER_STATUS_LABEL.cancelled}
                >
                  Cancel order
                </button>
              ) : null}

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

      <div className="mt-6 text-sm opacity-60">
        Allowed transitions from <code>{currentStatus}</code>: {nextOptions.join(', ') || 'none'}
      </div>
    </div>
  );
}