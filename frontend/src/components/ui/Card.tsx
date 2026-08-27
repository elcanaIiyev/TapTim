import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Adds lift + brand border on hover. Use for clickable cards only. */
  interactive?: boolean;
}

export function Card({ children, className, interactive = false }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-200 bg-white p-6 shadow-sm shadow-ink-900/[0.03]',
        'dark:border-ink-800 dark:bg-ink-900/60 dark:shadow-none',
        interactive &&
          'transition-all duration-300 ease-out motion-safe:hover:-translate-y-1 ' +
            'hover:border-brand-400/70 hover:shadow-xl hover:shadow-brand-500/10 ' +
            'dark:hover:border-brand-500/50 dark:hover:shadow-brand-500/[0.07]',
        className,
      )}
    >
      {children}
    </div>
  );
}
