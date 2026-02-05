// apps/web/src/components/Status.tsx
import type { OrderStatus } from '../lib/types';
import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from '../lib/orderStatus';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="text-sm">{label}</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="text-sm text-red-600">{message}</div>;
}

type EmptyStateProps =
  | {
      title?: string;
      description?: string;
      message?: never;
    }
  | {
      message: string;
      title?: never;
      description?: never;
    };

export function EmptyState(props: EmptyStateProps) {
  const title = 'title' in props ? props.title : undefined;
  const description = 'description' in props ? props.description : undefined;
  const message = 'message' in props ? props.message : undefined;

  const main = message ?? title ?? 'Nothing here';
  const sub = message ? undefined : description;

  return (
    <div className="rounded border p-4">
      <div className="text-sm font-semibold">{main}</div>
      {sub ? <div className="mt-1 text-sm opacity-80">{sub}</div> : null}
    </div>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus | string }) {
  const s = status as OrderStatus;
  const label = ORDER_STATUS_LABEL[s] ?? String(status);
  const cls = ORDER_STATUS_CLASS[s] ?? 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
