import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>

      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}

      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}