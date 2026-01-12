export function Loading({ label = 'Lade...' }: { label?: string }) {
  return <div>{label}</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div style={{ color: 'crimson', marginBottom: 8 }}>{message}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <div style={{ opacity: 0.8 }}>{message}</div>;
}
