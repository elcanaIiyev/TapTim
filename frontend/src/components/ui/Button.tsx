import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

// `cursor-pointer` is explicit: browsers default <button> to an arrow cursor,
// and Tailwind v4's preflight no longer overrides it.
//
// Buttons are rounded, hairline-bordered, and lift gently on hover (`press`).
// Labels stay sentence case: the previous uppercase tracking read as shouting
// once the surfaces softened.
const BASE =
  'group/btn relative inline-flex cursor-pointer select-none items-center justify-center gap-2 ' +
  'rounded-[var(--radius-soft-sm)] border font-semibold whitespace-nowrap ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none';

const VARIANTS: Record<Variant, string> = {
  // White on iris-600 is 5.70:1. The reverse (dark text on iris) is only
  // 3.42:1, so this fill always carries white.
  primary:
    'press border-iris-700 bg-iris-600 text-white shadow-[var(--shadow-soft-iris)] ' +
    'hover:bg-iris-700 dark:border-iris-500',
  secondary:
    'press panel-soft border-ink-800 bg-ink-900 text-ink-50 hover:bg-ink-800 ' +
    'dark:border-ink-300 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white',
  outline:
    'press panel-soft border-ink-300 bg-white text-ink-800 hover:border-iris-400 ' +
    'hover:bg-iris-50 hover:text-iris-700 dark:border-ink-700 dark:bg-ink-900 ' +
    'dark:text-ink-100 dark:hover:border-iris-500 dark:hover:bg-ink-800 dark:hover:text-iris-300',
  // The one unboxed variant, for tertiary actions inside dense toolbars.
  ghost:
    'border-transparent text-ink-600 transition-colors duration-200 hover:bg-iris-50 ' +
    'hover:text-iris-700 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-iris-300',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    /** Render as a router link instead of a `<button>`. */
    to?: string;
    /** Render as an anchor (external or in-page href). */
    href?: string;
  };

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  to,
  href,
  ...props
}: ButtonProps) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
