import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'brand' | 'accent' | 'neutral' | 'success' | 'warning';

// Flat fills with a hard 2px frame — no soft tinted pills, no rounding.
// Tone names are kept stable so callers do not all have to change.
const TONES: Record<Tone, string> = {
  brand: 'border-ink-950 bg-ink-950 text-ink-50 dark:border-ink-100 dark:bg-ink-100 dark:text-ink-950',
  accent: 'border-ink-950 bg-flame-600 text-ink-950 dark:border-ink-100',
  neutral:
    'border-ink-950 bg-transparent text-ink-800 dark:border-ink-400 dark:text-ink-200',
  success: 'border-ink-950 bg-signal-ok text-white dark:border-ink-100',
  warning: 'border-ink-950 bg-signal-warn text-white dark:border-ink-100',
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
        'type-label inline-flex items-center gap-1.5 border-2 px-2 py-0.5 font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
