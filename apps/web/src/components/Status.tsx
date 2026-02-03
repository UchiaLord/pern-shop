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
 * Read-only status badge for order lifecycle:
 * pending | paid | canceled | failed
 */
export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const text = label ?? value;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        border: '1px solid #ddd',
        fontSize: 12,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
      }}
      title={value}
    >
      {text}
    </span>
  );
}

export function OrderStatusBadge({
  status,
}: {
  status: 'pending' | 'paid' | 'canceled' | 'failed' | string;
}) {
  const label =
    status === 'pending'
      ? 'Pending'
      : status === 'paid'
        ? 'Paid'
        : status === 'canceled'
          ? 'Canceled'
          : status === 'failed'
            ? 'Failed'
            : status;

  return <StatusBadge value={status} label={label} />;
}