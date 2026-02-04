// apps/web/src/pages/AdminOrderDetailsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../lib/api';
import type { AdminOrderDetails, OrderStatus } from '../lib/types';
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

export default function AdminOrderDetailsPage() {
  const params = useParams();
  const id = Number(params.id);

  const [details, setDetails] = useState<AdminOrderDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nextStatus, setNextStatus] = useState<OrderStatus | ''>('');
  const [reason, setReason] = useState<string>('');

  const allowed: OrderStatus[] = useMemo(
    () => (details?.order.allowedNextStatuses ?? []) as OrderStatus[],
    [details],
  );

  const isValidId = Number.isFinite(id) && id > 0;

  function loadDetails() {
    setError(null);
    return api.admin.orders.get(id);
  }

  function reload() {
    if (!isValidId) return;

    loadDetails()
      .then((res) => {
        setDetails(res);

        const first = res.order.allowedNextStatuses[0] ?? '';
        setNextStatus(first as OrderStatus | '');
        setReason('');
      })
      .catch((err: unknown) => {
        setError(extractErrorMessage(err));
      });
  }

  async function submitStatusUpdate() {
    if (!details) return;
    if (!nextStatus) return;

    setError(null);

    try {
      const trimmed = reason.trim();
      const payload = trimmed.length > 0 ? { status: nextStatus, reason: trimmed } : { status: nextStatus };

      await api.admin.orders.updateStatus(id, payload);
      reload();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    }
  }

  useEffect(() => {
    if (!isValidId) return;

    loadDetails()
      .then((res) => {
        setDetails(res);

        const first = res.order.allowedNextStatuses[0] ?? '';
        setNextStatus(first as OrderStatus | '');
        setReason('');
      })
      .catch((err: unknown) => {
        setError(extractErrorMessage(err));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!isValidId) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Admin – Order</h2>
        <div style={{ color: 'crimson' }}>Ungültige Order-ID.</div>
        <div style={{ marginTop: 12 }}>
          <Link to="/admin/orders">Back</Link>
        </div>
      </div>
    );
  }

  if (error && !details) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Admin – Order</h2>
        <div style={{ color: 'crimson' }}>{error}</div>
        <div style={{ marginTop: 12 }}>
          <Link to="/admin/orders">Back</Link>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Admin – Order</h2>
        <div>Loading…</div>
      </div>
    );
  }

  const o = details.order;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2>Admin – Order #{o.id}</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/admin/orders">Back</Link>
          <button onClick={reload}>Reload</button>
        </div>
      </div>

      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>Summary</h3>
          <div>
            <strong>Status:</strong> {o.status}
          </div>
          <div>
            <strong>UserId:</strong> {o.userId}
          </div>
          <div>
            <strong>Subtotal:</strong> {formatMoney(o.subtotalCents, o.currency ?? 'EUR')}
          </div>
          <div>
            <strong>Created:</strong> {formatDate(o.createdAt)}
          </div>
          <div>
            <strong>Updated:</strong> {formatDate(o.updatedAt)}
          </div>
          <div>
            <strong>Paid:</strong> {o.paidAt ? formatDate(o.paidAt) : '—'}
          </div>
          <div>
            <strong>Shipped:</strong> {o.shippedAt ? formatDate(o.shippedAt) : '—'}
          </div>
          <div>
            <strong>Completed:</strong> {o.completedAt ? formatDate(o.completedAt) : '—'}
          </div>
        </div>

        <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>Change Status</h3>

          {allowed.length === 0 ? (
            <div>Keine weiteren Statuswechsel möglich.</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label>
                  Next status:{' '}
                  <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as OrderStatus)}>
                    {allowed.map((s: OrderStatus) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <button onClick={submitStatusUpdate}>Apply</button>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block' }}>
                  Reason (optional, 1..500):
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    style={{ width: '100%', marginTop: 6 }}
                    placeholder="Why are you changing the status?"
                    maxLength={500}
                  />
                </label>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{reason.length}/500</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Items</h3>
        {details.items.length === 0 ? (
          <div>Keine Items.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>SKU</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Qty</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Unit</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Line</th>
              </tr>
            </thead>
            <tbody>
              {details.items.map((it) => (
                <tr key={it.productId}>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{it.sku}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{it.name}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{it.quantity}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>
                    {formatMoney(it.unitPriceCents, it.currency)}
                  </td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>
                    {formatMoney(it.lineTotalCents, it.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 16, border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Status Timeline</h3>
        {o.statusEvents.length === 0 ? (
          <div>No events.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>When</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>From</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>To</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Actor</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {o.statusEvents.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{formatDate(ev.createdAt)}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{ev.fromStatus}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{ev.toStatus}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{ev.actorUserId ?? '—'}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: 8 }}>{ev.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
