// apps/web/src/pages/AdminOrdersPage.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api';
import type { OrderSummary } from '../lib/types';
import { extractErrorMessage } from '../lib/errors';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

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

function normalizeOrdersResponse(input: unknown): OrderSummary[] {
  if (typeof input !== 'object' || input === null) return [];
  const maybe = input as { orders?: unknown };
  return Array.isArray(maybe.orders) ? (maybe.orders as OrderSummary[]) : [];
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totals = useMemo(() => {
    const count = orders.length;
    const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});
    return { count, byStatus };
  }, [orders]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.admin.orders.list();
      const next = normalizeOrdersResponse(res);
      setOrders(next);

      if (!Array.isArray((res as { orders?: unknown }).orders)) {
        setError('Unerwartete Server-Antwort (orders fehlt oder ist kein Array).');
      }
    } catch (err: unknown) {
      setOrders([]);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Admin – Orders</h2>
        <Button onClick={fetchOrders} disabled={loading}>
          {loading ? 'Loading…' : 'Reload'}
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="font-semibold">Total:</span> {totals.count}
          </div>
          <div>
            <span className="font-semibold">Pending:</span> {totals.byStatus.pending ?? 0}
          </div>
          <div>
            <span className="font-semibold">Paid:</span> {totals.byStatus.paid ?? 0}
          </div>
          <div>
            <span className="font-semibold">Shipped:</span> {totals.byStatus.shipped ?? 0}
          </div>
          <div>
            <span className="font-semibold">Completed:</span> {totals.byStatus.completed ?? 0}
          </div>
          <div>
            <span className="font-semibold">Cancelled:</span> {totals.byStatus.cancelled ?? 0}
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-4">
          <div className="text-sm text-red-600">{error}</div>
        </Card>
      )}

      {!loading && orders.length === 0 ? (
        <EmptyState title="Keine Orders" description="Es wurden noch keine Bestellungen gefunden." />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b p-3">ID</th>
                  <th className="border-b p-3">Status</th>
                  <th className="border-b p-3">Subtotal</th>
                  <th className="border-b p-3">Created</th>
                  <th className="border-b p-3">Updated</th>
                  <th className="border-b p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-black/5">
                    <td className="border-b p-3">{o.id}</td>
                    <td className="border-b p-3">{o.status}</td>
                    <td className="border-b p-3">
                      {formatMoney(o.subtotalCents, o.currency ?? 'EUR')}
                    </td>
                    <td className="border-b p-3">{formatDate(o.createdAt)}</td>
                    <td className="border-b p-3">{formatDate(o.updatedAt)}</td>
                    <td className="border-b p-3">
                      <Link className="underline" to={`/admin/orders/${o.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
