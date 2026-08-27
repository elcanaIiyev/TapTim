import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Adds the press interaction. Use for clickable cards only. */
  interactive?: boolean;
  /** Drops the shadow — for cards sitting inside an already-framed grid. */
  flat?: boolean;
}

export function Card({ children, className, interactive = false, flat = false }: CardProps) {
  return (
    <div
      className={cn(
        'panel p-6',
        !flat && 'panel-soft',
        interactive && !flat && 'press',
        // Flat cards live in a shared grid, so they signal hover with a tint
        // rather than by lifting out of their neighbours.
        interactive &&
          flat &&
          'transition-colors duration-150 hover:bg-iris-50 dark:hover:bg-ink-800',
        className,
      )}
    >
      {children}
    </div>
  );
}
