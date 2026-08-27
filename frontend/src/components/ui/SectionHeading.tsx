import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface SectionHeadingProps {
  /** Mono overline. Rendered with an index rule, e.g. "02 / EVENTS". */
  overline?: string;
  /** Two-digit section index shown left of the overline. */
  index?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

/**
 * Section headings are left-aligned and asymmetric by default — centred stacks
 * are the template look this design moves away from. `align="center"` remains
 * available for the few places that genuinely need it (empty states, auth).
 */
export function SectionHeading({
  overline,
  index,
  title,
  description,
  align = 'left',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-3xl text-left',
        className,
      )}
    >
      {overline && (
        <div
          className={cn(
            'flex items-center gap-3',
            align === 'center' && 'justify-center',
          )}
        >
          {index && <span className="type-label text-accent-text">{index}</span>}
          <span className="type-label text-ink-600 dark:text-ink-400">{overline}</span>
          {align === 'left' && (
            <span aria-hidden="true" className="h-0.5 flex-1 bg-ink-950 dark:bg-ink-100" />
          )}
        </div>
      )}
      <h2 className="type-section mt-5 text-ink-950 dark:text-white">{title}</h2>
      {description && (
        <p
          className={cn(
            'mt-4 max-w-xl text-base leading-relaxed text-ink-600 dark:text-ink-300',
            align === 'center' && 'mx-auto',
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
