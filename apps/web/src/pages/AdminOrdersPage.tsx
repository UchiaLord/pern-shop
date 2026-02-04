import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api';
import type { OrderSummary } from '../lib/types';
import { extractErrorMessage } from '../lib/errors';

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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const count = orders.length;
    const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});
    return { count, byStatus };
  }, [orders]);

  function loadOrders() {
    setError(null);
    return api.admin.orders.list();
  }

  function reload() {
    loadOrders()
      .then((res) => {
        // Defensive: falls API mal "null" oder falsches Shape liefert
        const next = Array.isArray((res as any)?.orders) ? (res as any).orders : [];
        setOrders(next);
        if (!Array.isArray((res as any)?.orders)) {
          setError('Unerwartete Server-Antwort (orders fehlt).');
        }
      })
      .catch((err: unknown) => {
        setError(extractErrorMessage(err));
        setOrders([]); // damit UI stabil bleibt
      });
  }

  useEffect(() => {
    loadOrders()
      .then((res) => {
        const next = Array.isArray((res as any)?.orders) ? (res as any).orders : [];
        setOrders(next);
        if (!Array.isArray((res as any)?.orders)) {
          setError('Unerwartete Server-Antwort (orders fehlt).');
        }
      })
      .catch((err: unknown) => {
        setError(extractErrorMessage(err));
        setOrders([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Admin – Orders</h2>

      <div style={{ margin: '12px 0', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={reload}>Reload</button>
        <div>
          <strong>Total:</strong> {totals.count}
        </div>
        <div>
          <strong>Pending:</strong> {totals.byStatus.pending ?? 0}
        </div>
        <div>
          <strong>Paid:</strong> {totals.byStatus.paid ?? 0}
        </div>
        <div>
          <strong>Shipped:</strong> {totals.byStatus.shipped ?? 0}
        </div>
        <div>
          <strong>Completed:</strong> {totals.byStatus.completed ?? 0}
        </div>
        <div>
          <strong>Cancelled:</strong> {totals.byStatus.cancelled ?? 0}
        </div>
      </div>

      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}

      {orders.length === 0 ? (
        <div>Keine Orders.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>ID</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Subtotal</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Created</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Updated</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{o.id}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{o.status}</td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>
                  {formatMoney(o.subtotalCents, o.currency)}
                </td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>
                  {formatDate(o.createdAt)}
                </td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>
                  {formatDate(o.updatedAt)}
                </td>
                <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>
                  <Link to={`/admin/orders/${o.id}`}>Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}