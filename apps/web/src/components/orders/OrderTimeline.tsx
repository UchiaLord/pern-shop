// apps/web/src/components/orders/OrderTimeline.tsx
import { useMemo, useState } from 'react';

import type { OrderTimelineEvent } from '../../lib/types';

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function safeJson(value: unknown): string | null {
  if (value == null) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function titleFor(ev: OrderTimelineEvent): string {
  const from = ev.fromStatus ?? '—';
  const to = ev.toStatus ?? '—';

  if (ev.fromStatus == null && ev.toStatus != null) return `Status: ${to}`;
  if (ev.fromStatus != null && ev.toStatus != null) return `Statuswechsel: ${from} → ${to}`;
  return 'Event';
}

export default function OrderTimeline({
  title = 'Timeline',
  events,
  loading,
  error,
  emptyLabel = 'Keine Events.',
}: {
  title?: string;
  events: OrderTimelineEvent[];
  loading?: boolean;
  error?: string | null;
  emptyLabel?: string;
}) {
  const [openMetaIds, setOpenMetaIds] = useState<Set<number>>(() => new Set());

  const sorted = useMemo(() => {
    // Most recent first
    const copy = [...events];
    copy.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });
    return copy;
  }, [events]);

  const toggleMeta = (id: number) => {
    setOpenMetaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {loading ? <div className="text-xs opacity-70">Loading…</div> : null}
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && sorted.length === 0 ? <div className="text-sm">{emptyLabel}</div> : null}

      {sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.map((ev) => {
            const hasMeta = ev.metadata != null && safeJson(ev.metadata) != null;
            const isOpen = openMetaIds.has(ev.id);

            return (
              <div key={ev.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{titleFor(ev)}</div>
                    <div className="text-xs opacity-70">{formatDate(ev.createdAt)}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs opacity-80">
                    {ev.source ? (
                      <span className="rounded border px-2 py-1">source: {ev.source}</span>
                    ) : null}
                    {typeof ev.actorUserId === 'number' ? (
                      <span className="rounded border px-2 py-1">actor: {ev.actorUserId}</span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2 grid gap-1 text-sm">
                  {ev.reason ? (
                    <div>
                      <span className="font-semibold">Reason:</span> {ev.reason}
                    </div>
                  ) : null}
                </div>

                {hasMeta ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => toggleMeta(ev.id)}
                      className="text-xs underline opacity-80"
                    >
                      {isOpen ? 'Hide metadata' : 'Show metadata'}
                    </button>

                    {isOpen ? (
                      <pre className="mt-2 max-h-72 overflow-auto rounded-md border bg-black/5 p-2 text-xs">
                        {safeJson(ev.metadata)}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
