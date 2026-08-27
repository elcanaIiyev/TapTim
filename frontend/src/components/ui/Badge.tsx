import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'brand' | 'accent' | 'neutral' | 'success' | 'warning';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-500/12 text-brand-700 dark:text-brand-300 ring-brand-500/25',
  accent: 'bg-accent-500/12 text-accent-600 dark:text-accent-300 ring-accent-500/25',
  neutral:
    'bg-ink-500/10 text-ink-600 dark:text-ink-300 ring-ink-500/20',
  success: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25',
  warning: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/25',
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
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
