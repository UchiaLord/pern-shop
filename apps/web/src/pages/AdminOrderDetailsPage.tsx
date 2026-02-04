import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../lib/api';
import type { AdminOrderDetails, OrderStatus } from '../lib/types';
import { extractErrorMessage } from '../lib/errors';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

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

export default function AdminOrderDetailsPage() {
  const params = useParams();
  const id = Number(params.id);

  const [details, setDetails] = useState<AdminOrderDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [nextStatus, setNextStatus] = useState<OrderStatus | ''>('');
  const [reason, setReason] = useState<string>('');

  const isValidId = Number.isFinite(id) && id > 0;

  const allowed: OrderStatus[] = useMemo(() => {
    return (details?.order.allowedNextStatuses ?? []) as OrderStatus[];
  }, [details]);

  const fetchDetails = useCallback(async () => {
    if (!isValidId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.admin.orders.get(id);
      setDetails(res);

      const first = res.order.allowedNextStatuses[0] ?? '';
      setNextStatus(first as OrderStatus | '');
      setReason('');
    } catch (err: unknown) {
      setDetails(null);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, isValidId]);

  const reload = useCallback(() => {
    void fetchDetails();
  }, [fetchDetails]);

  const submitStatusUpdate = useCallback(async () => {
    if (!details) return;
    if (!nextStatus) return;

    setUpdating(true);
    setError(null);

    try {
      const trimmed = reason.trim();
      const payload =
        trimmed.length > 0 ? { status: nextStatus, reason: trimmed } : { status: nextStatus };

      await api.admin.orders.updateStatus(id, payload);
      await fetchDetails();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setUpdating(false);
    }
  }, [details, fetchDetails, id, nextStatus, reason]);

  useEffect(() => {
    void fetchDetails();
  }, [fetchDetails]);

  if (!isValidId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Admin – Order</h2>
          <Link className="underline" to="/admin/orders">
            Back
          </Link>
        </div>

        <Card className="p-4">
          <div className="text-sm text-red-600">Ungültige Order-ID.</div>
        </Card>
      </div>
    );
  }

  if (loading && !details) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Admin – Order</h2>
          <Link className="underline" to="/admin/orders">
            Back
          </Link>
        </div>

        <Card className="p-4">
          <div className="text-sm">Loading…</div>
        </Card>
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Admin – Order</h2>
          <Link className="underline" to="/admin/orders">
            Back
          </Link>
        </div>

        <Card className="p-4">
          <div className="text-sm text-red-600">{error}</div>
        </Card>
      </div>
    );
  }

  if (!details) {
    return (
      <EmptyState title="Order nicht geladen" description="Bitte versuche es erneut." />
    );
  }

  const o = details.order;
  const disableActions = loading || updating;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Admin – Order #{o.id}</h2>

        <div className="flex items-center gap-3">
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Summary</h3>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="opacity-70">Status</div>
            <div className="font-medium">{o.status}</div>

            <div className="opacity-70">UserId</div>
            <div className="font-medium">{o.userId}</div>

            <div className="opacity-70">Subtotal</div>
            <div className="font-medium">{formatMoney(o.subtotalCents, o.currency)}</div>

            <div className="opacity-70">Created</div>
            <div className="font-medium">{formatDate(o.createdAt)}</div>

            <div className="opacity-70">Updated</div>
            <div className="font-medium">{formatDate(o.updatedAt)}</div>

            <div className="opacity-70">Paid</div>
            <div className="font-medium">{o.paidAt ? formatDate(o.paidAt) : '—'}</div>

            <div className="opacity-70">Shipped</div>
            <div className="font-medium">{o.shippedAt ? formatDate(o.shippedAt) : '—'}</div>

            <div className="opacity-70">Completed</div>
            <div className="font-medium">{o.completedAt ? formatDate(o.completedAt) : '—'}</div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Change Status</h3>

          {allowed.length === 0 ? (
            <div className="text-sm opacity-80">Keine weiteren Statuswechsel möglich.</div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm">
                  <span className="mr-2 opacity-70">Next status</span>
                  <select
                    className="rounded-md border px-2 py-1 text-sm"
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

                <Button onClick={submitStatusUpdate} disabled={disableActions || !nextStatus}>
                  {updating ? 'Applying…' : 'Apply'}
                </Button>
              </div>

              <div className="space-y-1">
                <label className="block text-sm opacity-70">Reason (optional, 1..500)</label>
                <textarea
                  className="w-full rounded-md border p-2 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="Why are you changing the status?"
                  maxLength={500}
                  disabled={disableActions}
                />
                <div className="text-xs opacity-60">{reason.length}/500</div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Items</h3>

        {details.items.length === 0 ? (
          <div className="text-sm opacity-80">Keine Items.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b p-3">SKU</th>
                  <th className="border-b p-3">Name</th>
                  <th className="border-b p-3">Qty</th>
                  <th className="border-b p-3">Unit</th>
                  <th className="border-b p-3">Line</th>
                </tr>
              </thead>
              <tbody>
                {details.items.map((it) => (
                  <tr key={it.productId} className="hover:bg-black/5">
                    <td className="border-b p-3">{it.sku}</td>
                    <td className="border-b p-3">{it.name}</td>
                    <td className="border-b p-3">{it.quantity}</td>
                    <td className="border-b p-3">{formatMoney(it.unitPriceCents, it.currency)}</td>
                    <td className="border-b p-3">{formatMoney(it.lineTotalCents, it.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Status Timeline</h3>

        {o.statusEvents.length === 0 ? (
          <div className="text-sm opacity-80">No events.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b p-3">When</th>
                  <th className="border-b p-3">From</th>
                  <th className="border-b p-3">To</th>
                  <th className="border-b p-3">Actor</th>
                  <th className="border-b p-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {o.statusEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-black/5">
                    <td className="border-b p-3">{formatDate(ev.createdAt)}</td>
                    <td className="border-b p-3">{ev.fromStatus}</td>
                    <td className="border-b p-3">{ev.toStatus}</td>
                    <td className="border-b p-3">{ev.actorUserId ?? '—'}</td>
                    <td className="border-b p-3">{ev.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
