/**
 * Design-system constants shared by components. Colour values themselves live
 * in `index.css` under `@theme`; this file names the *decisions* so that
 * spacing, sizing, and type scale stay consistent across the app.
 */

export const SPACING = {
  sectionY: 'py-20 sm:py-24 lg:py-28',
  containerX: 'px-4 sm:px-6 lg:px-8',
  maxWidth: 'max-w-7xl',
} as const;

export const TYPE_SCALE = {
  display: 'text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight',
  h1: 'text-3xl sm:text-4xl font-bold tracking-tight',
  h2: 'text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight',
  h3: 'text-lg sm:text-xl font-semibold',
  body: 'text-base leading-relaxed',
  lead: 'text-lg sm:text-xl leading-relaxed',
  small: 'text-sm',
  overline: 'text-xs font-semibold uppercase tracking-[0.18em]',
} as const;

export const SURFACE = {
  card: 'bg-white dark:bg-ink-900/70 border border-ink-200 dark:border-ink-800',
  subtle: 'bg-ink-100/70 dark:bg-ink-900/40',
  inset: 'bg-ink-50 dark:bg-ink-950',
} as const;

export const TEXT = {
  muted: 'text-ink-500 dark:text-ink-400',
  strong: 'text-ink-900 dark:text-white',
} as const;

export const TRANSITION = 'transition-all duration-200 ease-out';
