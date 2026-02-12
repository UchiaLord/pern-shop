// apps/web/src/pages/AdminOrdersPage.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api';
import type { OrderSummary } from '../lib/types';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function StatusPill({ status }: { status: OrderSummary['status'] }) {
  // Minimal UI-only pill (keine Abhängigkeit von components/Status nötig)
  return <span className="rounded border px-2 py-1 text-xs">{status}</span>;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.admin.orders.list();
      setOrders(res.orders ?? []);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sorted = useMemo(() => {
    const copy = [...orders];
    copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return copy;
  }, [orders]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Admin – Orders</h2>
        <div className="flex items-center gap-3">
          <Button onClick={reload} disabled={loading}>
            {loading ? 'Loading…' : 'Reload'}
          </Button>
          <Link className="underline" to="/admin">
            Back
          </Link>
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <div className="text-sm text-red-600">{error}</div>
        </Card>
      ) : null}

      {loading ? (
        <Card className="p-4">
          <div className="text-sm">Loading…</div>
        </Card>
      ) : null}

      {!loading && sorted.length === 0 ? (
        <Card className="p-4">
          <EmptyState title="Keine Orders" description="Es existieren noch keine Orders im System." />
        </Card>
      ) : null}

      {!loading && sorted.length > 0 ? (
        <Card className="p-4">
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b p-2">Order</th>
                  <th className="border-b p-2">Status</th>
                  <th className="border-b p-2">UserId</th>
                  <th className="border-b p-2">Subtotal</th>
                  <th className="border-b p-2">Created</th>
                  <th className="border-b p-2">Updated</th>
                  <th className="border-b p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((o) => {
                  const cur = o.currency ?? 'EUR';
                  return (
                    <tr key={o.id} className="hover:bg-black/5">
                      <td className="border-b p-2 font-medium">#{o.id}</td>
                      <td className="border-b p-2">
                        <StatusPill status={o.status} />
                      </td>
                      <td className="border-b p-2">{o.userId}</td>
                      <td className="border-b p-2">{formatCents(o.subtotalCents, cur)}</td>
                      <td className="border-b p-2">{formatDate(o.createdAt)}</td>
                      <td className="border-b p-2">{formatDate(o.updatedAt)}</td>
                      <td className="border-b p-2">
                        <Link className="underline" to={`/admin/orders/${o.id}`}>
                          Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs opacity-70">
            Hinweis: Timeline ist in den Order-Details verfügbar.
          </div>
        </Card>
      ) : null}
    </div>
  );
}
