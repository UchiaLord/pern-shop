import { Card } from './Card';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={className ?? ''}>
      <div className="p-6 text-center">
        <div className="text-base font-semibold">{title}</div>
        {description ? <div className="mt-1 text-sm opacity-70">{description}</div> : null}
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </Card>
  );
}

export default EmptyState;
