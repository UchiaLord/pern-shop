import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';

import { EmptyState, ErrorBanner, Loading } from '../components/Status';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import type { OrderDetails } from '../lib/types';

function StatusChip({ status }: { status: string }) {
  const base = 'inline-flex items-center rounded-2xl border px-2 py-1 text-xs backdrop-blur-md border-white/10 bg-white/8';

  const cls =
    status === 'paid' || status === 'completed'
      ? 'text-[rgb(var(--accent))]'
      : status === 'pending'
        ? 'text-[rgb(var(--fg))]/80'
        : status === 'canceled' || status === 'failed'
          ? 'text-[rgb(var(--danger))]'
          : 'text-[rgb(var(--muted))]';

  return <span className={`${base} ${cls}`}>{status}</span>;
}

export default function OrderDetailsPage() {
  const params = useParams();
  const id = Number(params.id);

  const [data, setData] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isValidId = Number.isFinite(id) && id > 0;

  async function load() {
    if (!isValidId) {
      setError('Ungültige Order-ID.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.orders.get(id);
      setData(res);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const subtotal = useMemo(() => {
    if (!data) return null;
    return formatCents(data.order.subtotalCents, data.order.currency);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs tracking-widest text-[rgb(var(--muted))]">
            <Link className="hover:text-[rgb(var(--fg))]" to="/orders">
              ORDERS
            </Link>{' '}
            / DETAILS
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--fg))]">
            Order #{isValidId ? id : '—'}
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">Line items are price-frozen at checkout.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void load()} disabled={isLoading}>
            {isLoading ? 'Loading…' : 'Reload'}
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {isLoading ? <Loading /> : null}

      {!isLoading && !error && !data ? <EmptyState message="Keine Daten." /> : null}

      {data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Summary */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>Summary</span>
                  <StatusChip status={data.order.status} />
                </CardTitle>

                <div className="text-sm text-[rgb(var(--muted))]">{data.order.createdAt}</div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">Subtotal</span>
                  <span className="text-[rgb(var(--fg))]/90">{subtotal}</span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-xs text-[rgb(var(--muted))]">
                  Next: Stripe PaymentIntent + webhook-confirmed status transitions (paid/failed/refunded).
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs tracking-widest text-[rgb(var(--muted))]">ITEMS</div>
                <div className="text-sm text-[rgb(var(--muted))]">{data.items.length} items</div>
              </div>
            </div>

            {data.items.length === 0 ? <EmptyState message="Keine Items." /> : null}

            {data.items.length > 0 ? (
              <motion.div
                className="grid gap-4"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.04 } },
                }}
              >
                {data.items.map((it) => (
                  <motion.div
                    key={`${it.productId}-${it.sku}`}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0 },
                    }}
                    transition={{ duration: 0.18 }}
                  >
                    <Card>
                      <CardHeader className="space-y-1">
                        <CardTitle className="flex items-start justify-between gap-3">
                          <span className="leading-tight">{it.name}</span>
                          <span className="rounded-2xl border border-white/10 bg-white/6 px-2 py-1 text-xs text-[rgb(var(--muted))]">
                            {it.sku}
                          </span>
                        </CardTitle>

                        <div className="text-sm text-[rgb(var(--muted))]">
                          {formatCents(it.unitPriceCents, it.currency)} × {it.quantity} ={' '}
                          <span className="text-[rgb(var(--fg))]/90">
                            {formatCents(it.lineTotalCents, it.currency)}
                          </span>
                        </div>
                      </CardHeader>

                      <CardContent className="text-xs text-[rgb(var(--muted))]">
                        Product ID: <span className="text-[rgb(var(--fg))]/70">{it.productId}</span>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}