import type { OrderStatus } from '../lib/orderStatus';
import { ORDER_STATUS_LABEL, ORDER_STATUS_CLASS } from '../lib/orderStatus';

export function Loading({ label = 'Lade...' }: { label?: string }) {
  return <div>{label}</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div style={{ color: 'crimson', marginBottom: 8 }}>{message}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <div style={{ opacity: 0.8 }}>{message}</div>;
}

/**
 * Read-only badge for order lifecycle.
 * Uses Tailwind classes from lib/orderStatus.
 */
export function OrderStatusBadge({ status }: { status: OrderStatus | string }) {
  const isKnown =
    status === 'pending' ||
    status === 'paid' ||
    status === 'shipped' ||
    status === 'completed' ||
    status === 'cancelled';

  const label = isKnown ? ORDER_STATUS_LABEL[status] : String(status);
  const cls = isKnown ? ORDER_STATUS_CLASS[status] : 'bg-gray-200 text-gray-700';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
      title={String(status)}
    >
      {label}
    </span>
  );
}