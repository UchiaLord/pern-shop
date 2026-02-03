import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import type { OrderDetails } from '../lib/types';
import { EmptyState, ErrorBanner, Loading, OrderStatusBadge } from '../components/Status';
import { ORDER_STATUS_LABEL, allowedNextStatuses, type OrderStatus } from '../lib/orderStatus';

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

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

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
            <span className="font-medium">Updated:</span> {fmtMaybeIso((order as any).updatedAt)}
          </div>
          <div className="opacity-80">
            <span className="font-medium">Paid:</span> {fmtMaybeIso((order as any).paidAt)}
          </div>
          <div className="opacity-80">
            <span className="font-medium">Shipped:</span> {fmtMaybeIso((order as any).shippedAt)}
          </div>
          <div className="opacity-80">
            <span className="font-medium">Completed:</span> {fmtMaybeIso((order as any).completedAt)}
          </div>
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
                  onClick={() => setConfirmCancelOpen(true)}
                  className="rounded-md border px-3 py-1 text-sm"
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

      {confirmCancelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmCancelOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md rounded-lg border bg-neutral-950 p-4 shadow-lg">
            <div className="text-base font-semibold">Order wirklich stornieren?</div>
            <div className="mt-2 text-sm opacity-80">
              Das setzt den Status auf <code>cancelled</code>. Danach sind keine weiteren Transitions mehr möglich.
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-1 text-sm"
                onClick={() => setConfirmCancelOpen(false)}
                disabled={busy}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-1 text-sm"
                onClick={() => {
                  setConfirmCancelOpen(false);
                  void applyStatus('cancelled');
                }}
                disabled={busy}
              >
                Ja, stornieren
              </button>
            </div>
          </div>
        </div>
      ) : null}

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