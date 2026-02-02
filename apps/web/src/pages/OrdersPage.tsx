import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { ErrorBanner, Loading } from '../components/Status';
import EmptyState from '../components/ui/EmptyState';

import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import type { OrderSummary } from '../lib/types';

import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL, type OrderStatus } from '../lib/orderStatus';

function normalizeStatus(raw: string): OrderStatus {
  // Backward compatibility for older server values.
  // "completed" treated like "paid".
  if (raw === 'completed') return 'paid';
  if (raw === 'pending' || raw === 'paid' || raw === 'canceled' || raw === 'failed') return raw;
  return 'pending';
}

function StatusChip({ status }: { status: string }) {
  const s = normalizeStatus(status);
  const base = 'inline-flex items-center rounded-2xl border border-white/10 bg-white/8 px-2 py-1 text-xs backdrop-blur-md';
  const cls = ORDER_STATUS_CLASS[s];
  const label = ORDER_STATUS_LABEL[s];

  return <span className={`${base} ${cls}`}>{label}</span>;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const copy = [...orders];
    copy.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return copy;
  }, [orders]);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.orders.listMine();
      setOrders(res.orders);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs tracking-widest text-[rgb(var(--muted))]">ACCOUNT</div>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--fg))]">Orders</h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Your recent purchases. Status handling will expand with Stripe webhooks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void load()} disabled={isLoading}>
            {isLoading ? 'Loading…' : 'Reload'}
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {isLoading ? <Loading /> : null}

      {!isLoading && !error && sorted.length === 0 ? (
        <EmptyState
          title="Keine Bestellungen"
          description="Sobald du etwas kaufst, erscheinen deine Bestellungen hier."
          action={
            <Link to="/products">
              <Button>Produkte entdecken</Button>
            </Link>
          }
        />
      ) : null}

      {!isLoading && !error && sorted.length > 0 ? (
        <motion.div
          className="grid gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {sorted.map((o) => (
            <motion.div
              key={o.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.18 }}
            >
              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Link className="hover:underline" to={`/orders/${o.id}`}>
                        Order #{o.id}
                      </Link>
                      <StatusChip status={o.status} />
                    </div>

                    <div className="text-sm text-[rgb(var(--muted))]">
                      {formatCents(o.subtotalCents, o.currency)}
                    </div>
                  </CardTitle>

                  <div className="text-xs text-[rgb(var(--muted))]">{o.createdAt}</div>
                </CardHeader>

                <CardContent className="flex items-center justify-end">
                  <Link to={`/orders/${o.id}`}>
                    <Button variant="ghost">Details</Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      ) : null}
    </div>
  );
}