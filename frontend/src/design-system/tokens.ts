/**
 * Design-system constants shared by components — the Soft Editorial system
 * derived from ui-ux-pro-max's "Calm lavender + mindful green" profile
 * (see `design-system/taptim/MASTER.md`).
 *
 * Colour values live in `index.css` under `@theme`, and the type scale is
 * expressed there as the `.type-*` utilities so the clamp() sizing lives in
 * one place. This file names the *decisions* that are otherwise just repeated
 * class strings, so spacing, surfaces, and muted-text pairings stay consistent.
 */

export const SPACING = {
  sectionY: 'py-20 sm:py-24',
  containerX: 'px-4 sm:px-6 lg:px-8',
  maxWidth: 'max-w-7xl',
} as const;

/**
 * `hero`/`display`/`section` are CSS utilities rather than Tailwind chains
 * because they carry clamp() sizing plus the negative tracking that keeps the
 * type editorial. `label` is the mono overline used for every small caps run.
 */
export const TYPE_SCALE = {
  hero: 'type-hero',
  display: 'type-display',
  section: 'type-section',
  h3: 'text-lg font-bold tracking-tight',
  body: 'text-base leading-relaxed',
  lead: 'text-lg leading-relaxed',
  small: 'text-sm',
  label: 'type-label',
  quote: 'type-quote',
} as const;

/**
 * Surfaces are rounded panels with a hairline border and a layered, diffuse
 * shadow. `inverted` is dark in both themes, so it must also carry
 * `surface-dark` for the accent tokens to resolve to their dark-side values.
 */
export const SURFACE = {
  card: 'panel panel-soft',
  flat: 'panel',
  inverted: 'surface-dark rounded-[var(--radius-soft)] bg-ink-900 dark:bg-ink-900',
  inset: 'bg-ink-100 dark:bg-ink-900/40',
} as const;

/**
 * Muted text is ink-600 rather than ink-500 so body copy clears 4.5:1 against
 * the tinted background.
 */
export const TEXT = {
  muted: 'text-ink-600 dark:text-ink-400',
  strong: 'text-ink-900 dark:text-white',
  /** Accent as text; flips iris-600/iris-400 by theme for contrast. */
  accent: 'text-accent-text',
  /** Success as text; flips fern-700/fern-500 by theme for contrast. */
  success: 'text-success-text',
} as const;

/** Softened motion: 200ms eased, matching the panel press. */
export const TRANSITION = 'transition-colors duration-200 ease-out';
