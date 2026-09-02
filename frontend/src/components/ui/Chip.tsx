import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * A selectable option that lights up green when it is on.
 *
 * A real `<button>` with `aria-pressed`, not a styled `<div>` or a hidden
 * checkbox: `aria-pressed` is exactly the toggle-button semantic, so a screen
 * reader announces "pressed"/"not pressed" without any extra description, and
 * the CSS keys its lit state off the same attribute rather than a parallel
 * class. There is one source of truth for "is this on".
 */
export function Chip({
  label,
  selected,
  onToggle,
  disabled = false,
  className,
}: {
  label: ReactNode;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn('chip', className)}
    >
      <span className="chip-dot" aria-hidden="true" />
      {label}
    </button>
  );
}

/**
 * A labelled group of chips over a fixed vocabulary.
 *
 * `role="group"` rather than a fieldset of checkboxes: these are toggle
 * buttons, and wrapping them in a form control group would promise submit
 * semantics the profile builder does not use — it saves through one button at
 * the bottom.
 */
export function ChipGroup({
  legend,
  hint,
  options,
  selected,
  onChange,
  max,
  columns = 'auto',
  labels,
}: {
  legend: string;
  hint?: string;
  options: readonly string[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  /** Caps the selection; further chips go disabled rather than silently failing. */
  max?: number;
  columns?: 'auto' | 'two';
  /**
   * Display text per option, when the stored value is not what a person should
   * read — availability is stored as `weekday-mornings` because the matching
   * engine intersects those keys, but nobody should be shown a slug.
   */
  labels?: Record<string, string>;
}) {
  const atLimit = max !== undefined && selected.length >= max;

  const toggle = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter((entry) => entry !== option)
        : [...selected, option],
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="type-label text-ink-700 dark:text-ink-300">{legend}</p>
        <p className="readout text-xs text-ink-500 dark:text-ink-400">
          {selected.length}
          {max !== undefined ? ` / ${max}` : ''} selected
        </p>
      </div>

      {hint && <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-400">{hint}</p>}

      <div
        role="group"
        aria-label={legend}
        className={cn(
          'mt-3 flex flex-wrap gap-2',
          columns === 'two' && 'sm:grid sm:grid-cols-2',
        )}
      >
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <Chip
              key={option}
              label={labels?.[option] ?? option}
              selected={isSelected}
              // At the cap, only the already-selected chips stay live so a
              // choice can still be swapped without clearing the whole group.
              disabled={atLimit && !isSelected}
              onToggle={() => toggle(option)}
            />
          );
        })}
      </div>
    </div>
  );
}
