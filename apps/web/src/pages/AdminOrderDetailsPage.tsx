// apps/web/src/pages/AdminOrderDetailsPage.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../lib/api';
import type { AdminOrderDetails, OrderStatus, OrderTimelineEvent } from '../lib/types';
import { extractErrorMessage } from '../lib/errors';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

import OrderTimeline from '../components/orders/OrderTimeline';

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency }).format(cents / 100);
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function normalizeAllowedNextStatuses(input: unknown): OrderStatus[] {
  if (!Array.isArray(input)) return [];
  return input.filter((v): v is OrderStatus => typeof v === 'string') as OrderStatus[];
}

function normalizeItems(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input as AdminOrderDetails['items'];
}

function normalizeStatusEvents(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input as AdminOrderDetails['order']['statusEvents'];
}

function mapLegacyStatusEventsToTimeline(
  events: AdminOrderDetails['order']['statusEvents'],
): OrderTimelineEvent[] {
  return (events ?? []).map((ev) => ({
    id: ev.id,
    createdAt: ev.createdAt,
    fromStatus: ev.fromStatus ?? null,
    toStatus: ev.toStatus ?? null,
    actorUserId: ev.actorUserId ?? null,
    reason: ev.reason ?? null,
    source: null,
    metadata: null,
  }));
}

export default function AdminOrderDetailsPage() {
  const params = useParams();
  const id = Number(params.id);
  const isValidId = Number.isFinite(id) && id > 0;

  const [details, setDetails] = useState<AdminOrderDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nextStatus, setNextStatus] = useState<OrderStatus | ''>('');
  const [reason, setReason] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [timeline, setTimeline] = useState<OrderTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const allowed: OrderStatus[] = useMemo(() => {
    const raw = details?.order?.allowedNextStatuses;
    return normalizeAllowedNextStatuses(raw);
  }, [details]);

  const safeItems = useMemo(() => normalizeItems(details?.items), [details]);
  const safeStatusEvents = useMemo(
    () => normalizeStatusEvents(details?.order?.statusEvents),
    [details],
  );

  const mergedTimeline: OrderTimelineEvent[] = useMemo(() => {
    // Prefer dedicated endpoint (includes source/metadata). Fallback to legacy embedded statusEvents.
    if (timeline.length > 0) return timeline;
    return mapLegacyStatusEventsToTimeline(safeStatusEvents);
  }, [safeStatusEvents, timeline]);

  const reload = useCallback(async () => {
    if (!isValidId) return;

    setLoading(true);
    setError(null);

    setTimelineLoading(true);
    setTimelineError(null);

    try {
      const [detailsRes, timelineRes] = await Promise.allSettled([
        api.admin.orders.get(id),
        api.admin.orders.getTimeline(id),
      ]);

      if (detailsRes.status === 'fulfilled') {
        setDetails(detailsRes.value);

        const nextAllowed = normalizeAllowedNextStatuses(detailsRes.value?.order?.allowedNextStatuses);
        const first = nextAllowed[0] ?? '';
        setNextStatus(first);
        setReason('');
      } else {
        setError(extractErrorMessage(detailsRes.reason));
      }

      if (timelineRes.status === 'fulfilled') {
        setTimeline(timelineRes.value.events);
      } else {
        // Soft fail – page stays usable; timeline falls back to embedded statusEvents.
        setTimelineError(extractErrorMessage(timelineRes.reason));
        setTimeline([]);
      }
    } finally {
      setLoading(false);
      setTimelineLoading(false);
    }
  }, [id, isValidId]);

  const submitStatusUpdate = useCallback(async () => {
    if (!isValidId) return;
    if (!details) return;
    if (!nextStatus) return;
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const trimmed = reason.trim();
      const payload =
        trimmed.length > 0 ? { status: nextStatus, reason: trimmed } : { status: nextStatus };

      await api.admin.orders.updateStatus(id, payload);
      await reload();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [details, id, isValidId, nextStatus, reason, reload, saving]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!isValidId) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Admin – Order</h2>
        <Card className="p-4">
          <div className="text-sm text-red-600">Ungültige Order-ID.</div>
        </Card>
        <div>
          <Link className="underline" to="/admin/orders">
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Admin – Order</h2>
        <Card className="p-4">
          <div className="text-sm text-red-600">{error}</div>
        </Card>
        <div>
          <Link className="underline" to="/admin/orders">
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Admin – Order</h2>
        <Card className="p-4">
          <div className="text-sm">Loading…</div>
        </Card>
      </div>
    );
  }

  const o = details.order;
  const canChangeStatus = allowed.length > 0;
  const disableActions = loading || saving;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Admin – Order #{o.id}</h2>
        <div className="flex flex-wrap gap-3">
          <Link className="underline" to="/admin/orders">
            Back
          </Link>
          <Button onClick={reload} disabled={disableActions}>
            {loading ? 'Loading…' : 'Reload'}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4">
          <div className="text-sm text-red-600">{error}</div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-base font-semibold">Summary</h3>
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-semibold">Status:</span> {o.status}
            </div>
            <div>
              <span className="font-semibold">UserId:</span> {o.userId}
            </div>
            <div>
              <span className="font-semibold">Subtotal:</span>{' '}
              {formatMoney(o.subtotalCents, o.currency ?? 'EUR')}
            </div>
            <div>
              <span className="font-semibold">Created:</span> {formatDate(o.createdAt)}
            </div>
            <div>
              <span className="font-semibold">Updated:</span> {formatDate(o.updatedAt)}
            </div>
            <div>
              <span className="font-semibold">Paid:</span> {o.paidAt ? formatDate(o.paidAt) : '—'}
            </div>
            <div>
              <span className="font-semibold">Shipped:</span>{' '}
              {o.shippedAt ? formatDate(o.shippedAt) : '—'}
            </div>
            <div>
              <span className="font-semibold">Completed:</span>{' '}
              {o.completedAt ? formatDate(o.completedAt) : '—'}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-base font-semibold">Change Status</h3>

          {!canChangeStatus ? (
            <EmptyState
              title="Keine weiteren Statuswechsel möglich"
              description="Für diesen Order gibt es aktuell keine erlaubten Übergänge."
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm">
                  <span className="mr-2 font-semibold">Next status:</span>
                  <select
                    className="rounded border px-2 py-1"
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                    disabled={disableActions}
                  >
                    {allowed.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <Button
                  onClick={submitStatusUpdate}
                  disabled={disableActions || !nextStatus}
                  aria-disabled={disableActions || !nextStatus}
                >
                  {saving ? 'Applying…' : 'Apply'}
                </Button>
              </div>

              <div>
                <label className="block text-sm font-semibold" htmlFor="reason">
                  Reason (optional, 1..500)
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded border p-2"
                  placeholder="Why are you changing the status?"
                  maxLength={500}
                  disabled={disableActions}
                />
                <div className="mt-1 text-xs opacity-70">{reason.length}/500</div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-base font-semibold">Items</h3>

        {safeItems.length === 0 ? (
          <div className="text-sm">Keine Items.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b p-2">SKU</th>
                  <th className="border-b p-2">Name</th>
                  <th className="border-b p-2">Qty</th>
                  <th className="border-b p-2">Unit</th>
                  <th className="border-b p-2">Line</th>
                </tr>
              </thead>
              <tbody>
                {safeItems.map((it) => (
                  <tr key={it.productId} className="hover:bg-black/5">
                    <td className="border-b p-2">{it.sku}</td>
                    <td className="border-b p-2">{it.name}</td>
                    <td className="border-b p-2">{it.quantity}</td>
                    <td className="border-b p-2">{formatMoney(it.unitPriceCents, it.currency)}</td>
                    <td className="border-b p-2">{formatMoney(it.lineTotalCents, it.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <OrderTimeline
          title="Status Timeline"
          events={mergedTimeline}
          loading={timelineLoading}
          error={timelineError}
          emptyLabel="No events."
        />
        {timelineError ? (
          <div className="mt-2 text-xs opacity-70">
            Hinweis: Wenn <code>/admin/orders/:id/timeline</code> nicht verfügbar ist, wird auf{' '}
            <code>order.statusEvents</code> zurückgefallen.
          </div>
        ) : null}
      </Card>
    </div>
  );
}
