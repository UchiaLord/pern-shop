// apps/web/src/pages/OrderDetailsPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import type { OrderDetails, OrderStatus, OrderTimelineEvent } from '../lib/types';

import { EmptyState, ErrorBanner, Loading, OrderStatusBadge } from '../components/Status';
import OrderTimeline from '../components/orders/OrderTimeline';

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_MS = 30_000;

function isTerminal(status: OrderStatus): boolean {
  return status === 'paid' || status === 'shipped' || status === 'completed' || status === 'cancelled';
}

export default function OrderDetailsPage() {
  const { id } = useParams();
  const orderId = Number(id);

  const [data, setData] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [polling, setPolling] = useState(false);

  const pollStartRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const [timeline, setTimeline] = useState<OrderTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const validId = Number.isFinite(orderId) && orderId > 0;
  const status = data?.order?.status ?? null;

  const shouldPoll = useMemo(() => {
    // Only poll if we have data and order is pending
    if (!data) return false;
    if (status !== 'pending') return false;
    return true;
  }, [data, status]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollStartRef.current = null;
    setPolling(false);
  }, []);

  const loadTimeline = useCallback(async () => {
    if (!validId) return;

    setTimelineLoading(true);
    setTimelineError(null);

    try {
      const res = await api.orders.getTimeline(orderId);
      setTimeline(res.events ?? []);
    } catch (err: unknown) {
      // Soft fail: Order page should still work without timeline
      setTimelineError(extractErrorMessage(err));
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [orderId, validId]);

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!validId) return;

      const silent = Boolean(opts?.silent);

      setError(null);
      if (!silent) setLoading(true);

      try {
        const res = await api.orders.get(orderId);
        setData(res);

        const nextStatus = res?.order?.status;
        if (nextStatus && isTerminal(nextStatus)) {
          stopPolling();
        }
      } catch (err: unknown) {
        setError(extractErrorMessage(err));
        stopPolling();
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderId, stopPolling, validId],
  );

  // initial load / id change
  useEffect(() => {
    stopPolling();

    if (!validId) {
      setLoading(false);
      setData(null);
      setError(null);
      setTimeline([]);
      setTimelineError(null);
      setTimelineLoading(false);
      return;
    }

    void reload();
    void loadTimeline();
  }, [loadTimeline, reload, stopPolling, validId]);

  // polling loop: pending -> wait for webhook to mark paid
  useEffect(() => {
    if (!validId) return;

    if (!shouldPoll) {
      stopPolling();
      return;
    }

    if (pollStartRef.current == null) {
      pollStartRef.current = Date.now();
    }

    const elapsed = Date.now() - (pollStartRef.current ?? Date.now());
    if (elapsed >= POLL_MAX_MS) {
      stopPolling();
      return;
    }

    setPolling(true);

    pollTimerRef.current = window.setTimeout(() => {
      void reload({ silent: true });
      void loadTimeline();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current != null) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [loadTimeline, reload, shouldPoll, stopPolling, validId]);

  if (!validId) {
    return <EmptyState message="Ungültige Order-ID." />;
  }

  if (loading) return <Loading label="Lade Order..." />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return <EmptyState message="Order nicht gefunden." />;

  const { order, items } = data;
  const cur = order.currency ?? 'EUR';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Order #{order.id}</h2>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void reload();
              void loadTimeline();
            }}
            className="rounded-md border px-3 py-1 text-sm"
            disabled={loading}
          >
            Reload
          </button>

          <Link className="text-sm underline" to="/orders">
            Back
          </Link>
        </div>
      </div>

      {order.status === 'pending' ? (
        <div className="rounded-lg border p-3 text-sm">
          <div className="font-medium">Payment wird verarbeitet…</div>
          <div className="opacity-80">
            {polling
              ? 'Wir aktualisieren automatisch. Sobald der Stripe Webhook ankommt, wechselt der Status auf paid.'
              : 'Status ist noch pending. Wenn du gerade bezahlt hast, warte kurz oder klicke Reload.'}
          </div>
          {!polling ? (
            <div className="mt-2 text-xs opacity-70">
              Hinweis: Webhooks sind asynchron. In Dev kann das (je nach Stripe CLI) ein paar Sekunden dauern.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border p-3">
        <div className="text-sm opacity-80">
          Currency: {cur} · Subtotal: {formatCents(order.subtotalCents, cur)}
        </div>

        <div className="mt-2 grid gap-1 text-xs opacity-70">
          {order.paidAt ? <div>Paid at: {new Date(order.paidAt).toLocaleString()}</div> : null}
          {order.shippedAt ? <div>Shipped at: {new Date(order.shippedAt).toLocaleString()}</div> : null}
          {order.completedAt ? (
            <div>Completed at: {new Date(order.completedAt).toLocaleString()}</div>
          ) : null}
        </div>
      </div>

      <h3 className="mt-2 text-lg font-semibold">Items</h3>

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
                  {i.quantity} × {formatCents(i.unitPriceCents, i.currency)}
                </div>
                <div className="font-semibold">{formatCents(i.lineTotalCents, i.currency)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-3">
        <OrderTimeline
          title="Timeline"
          events={timeline}
          loading={timelineLoading}
          error={timelineError}
          emptyLabel="No events."
        />
        {timelineError ? (
          <div className="mt-2 text-xs opacity-70">
            Hinweis: Wenn <code>/orders/:id/timeline</code> nicht verfügbar ist, bleibt die Order-Ansicht trotzdem nutzbar.
          </div>
        ) : null}
      </div>

      {order.status === 'pending' && !polling ? (
        <div className="text-xs opacity-70">
          Wenn der Status nach ~30s nicht auf <code>paid</code> geht: Stripe CLI Webhook Forwarding prüfen +{' '}
          <code>STRIPE_WEBHOOK_SECRET</code> in <code>apps/api/.env</code>.
        </div>
      ) : null}
    </div>
  );
}
