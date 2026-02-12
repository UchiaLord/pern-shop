// apps/web/src/components/ui/EmptyState.tsx
import type { ReactNode } from 'react';

type EmptyStateBase = {
  action?: ReactNode;
};

type EmptyStateProps =
  | (EmptyStateBase & {
      title?: string;
      description?: string;
      message?: never;
    })
  | (EmptyStateBase & {
      message: string;
      title?: never;
      description?: never;
    });

export default function EmptyState(props: EmptyStateProps) {
  const title = 'title' in props ? props.title : undefined;
  const description = 'description' in props ? props.description : undefined;
  const message = 'message' in props ? props.message : undefined;

  const main = message ?? title ?? 'Nothing here';
  const sub = message ? undefined : description;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-md shadow-xl shadow-black/20">
      <div className="text-sm font-semibold text-[rgb(var(--fg))]">{main}</div>

      {sub ? <div className="mt-1 text-sm text-[rgb(var(--muted))]">{sub}</div> : null}

      {props.action ? <div className="mt-3">{props.action}</div> : null}
    </div>
  );
}
