import type { OrderStatus } from '../lib/orderStatus';
import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from '../lib/orderStatus';

export function Loading({ label = 'Lade...' }: { label?: string }) {
  return <div>{label}</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div style={{ color: 'crimson', marginBottom: 8 }}>{message}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <div style={{ opacity: 0.8 }}>{message}</div>;
}

function fallbackLabel(status: string) {
  // defensive: falls API mal etwas Unerwartetes liefert
  return status;
}

function isOrderStatus(x: string): x is OrderStatus {
  return x === 'pending' || x === 'paid' || x === 'shipped' || x === 'completed' || x === 'cancelled';
}

/**
 * Read-only badge for order lifecycle.
 * Uses Tailwind classes from lib/orderStatus.
 */
export function OrderStatusBadge({ status }: { status: OrderStatus | string }) {
  const normalized = typeof status === 'string' ? status : String(status);

  const label = isOrderStatus(normalized) ? ORDER_STATUS_LABEL[normalized] : fallbackLabel(normalized);
  const cls = isOrderStatus(normalized)
    ? ORDER_STATUS_CLASS[normalized]
    : 'bg-gray-200 text-gray-700';

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${cls}`}
      title={normalized}
    >
      {label}
    </span>
  );
}