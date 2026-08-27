import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Adds the press interaction. Use for clickable cards only. */
  interactive?: boolean;
  /** Drops the offset shadow — for cards sitting inside an already-framed grid. */
  flat?: boolean;
}

export function Card({ children, className, interactive = false, flat = false }: CardProps) {
  return (
    <div
      className={cn(
        'brut-box p-6',
        !flat && 'brut-shadow',
        interactive && !flat && 'brut-press',
        // Flat cards live in a shared grid, so they signal hover with the
        // accent rather than by moving — nothing to move into.
        interactive &&
          flat &&
          'transition-colors duration-150 hover:bg-flame-50 dark:hover:bg-ink-800',
        className,
      )}
    >
      {children}
    </div>
  );
}
