import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'ghost' | 'danger';

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium ' +
    'transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ' +
    'focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ring))]/60 focus:ring-offset-0';

  const styles: Record<Variant, string> = {
    primary:
      'text-[rgb(var(--fg))] ' +
      'bg-white/10 border border-white/15 backdrop-blur-md shadow-lg shadow-black/20 ' +
      'hover:bg-white/14',
    ghost: 'text-[rgb(var(--fg))] bg-transparent border border-white/10 hover:bg-white/8',
    danger:
      'text-[rgb(var(--fg))] bg-[rgb(var(--danger))]/20 border border-[rgb(var(--danger))]/35 ' +
      'hover:bg-[rgb(var(--danger))]/26',
  };

  return <button className={cn(base, styles[variant], className)} {...props} />;
}
