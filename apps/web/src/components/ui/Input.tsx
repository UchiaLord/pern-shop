import type { InputHTMLAttributes } from 'react';
import { cn } from './cn';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-2xl border border-white/12 bg-white/6 px-3 text-sm ' +
          'text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] ' +
          'outline-none backdrop-blur-md ' +
          'focus:ring-2 focus:ring-[rgb(var(--ring))]/60',
        className,
      )}
      {...props}
    />
  );
}