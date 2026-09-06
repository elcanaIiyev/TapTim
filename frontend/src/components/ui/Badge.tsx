import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'brand' | 'accent' | 'neutral' | 'success' | 'warning';

/*
  Soft tinted pills. Each tone is a low-opacity wash with a matching border and
  a text shade dark enough to clear 4.5:1 against that wash — which is why the
  text colour differs per tone rather than every tone using white. Tone names
  are kept stable so callers do not all have to change.
*/
const TONES: Record<Tone, string> = {
  brand:
    'border-iris-200 bg-iris-100 text-iris-800 dark:border-iris-500/30 dark:bg-iris-500/15 dark:text-iris-200',
  // The one solid fill, for "featured". White on iris-600 is 5.70:1.
  accent: 'border-iris-700 bg-iris-600 text-white dark:border-iris-500',
  neutral:
    'border-ink-200 bg-ink-100 text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200',
  success:
    'border-fern-200 bg-fern-100 text-fern-800 dark:border-fern-500/30 dark:bg-fern-500/15 dark:text-fern-200',
  warning:
    'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200',
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'type-tag inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
