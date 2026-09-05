import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Adds the press interaction. Use for clickable cards only. */
  interactive?: boolean;
  /** Drops the shadow — for cards sitting inside an already-framed grid. */
  flat?: boolean;
  /**
   * Set false when the card's own children own the edges — a cover image has to
   * reach the corners. A prop rather than a `p-0` override in `className`:
   * `cn` is a plain join with no conflict resolution, so both paddings would
   * survive and the stylesheet order would decide, not the caller.
   */
  padded?: boolean;
}

export function Card({
  children,
  className,
  interactive = false,
  flat = false,
  padded = true,
}: CardProps) {
  return (
    <div
      className={cn(
        'panel',
        padded && 'p-6',
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
