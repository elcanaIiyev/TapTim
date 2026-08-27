import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

// `cursor-pointer` is explicit: browsers default <button> to an arrow cursor,
// and Tailwind v4's preflight no longer overrides it.
const BASE =
  'inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-xl font-semibold ' +
  'transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-55 ' +
  'disabled:pointer-events-none whitespace-nowrap';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-lg shadow-brand-600/25 hover:bg-brand-500 ' +
    'hover:shadow-xl hover:shadow-brand-500/40 motion-safe:hover:-translate-y-0.5 ' +
    'active:translate-y-0 active:shadow-md',
  secondary:
    'bg-ink-900 text-white shadow-lg shadow-ink-900/15 hover:bg-ink-800 ' +
    'motion-safe:hover:-translate-y-0.5 active:translate-y-0 ' +
    'dark:bg-white dark:text-ink-900 dark:shadow-white/10 dark:hover:bg-ink-100',
  outline:
    'border border-ink-300 text-ink-700 hover:border-brand-400 hover:bg-brand-500/5 ' +
    'hover:text-brand-600 active:bg-brand-500/10 ' +
    'dark:border-ink-700 dark:text-ink-200 dark:hover:border-brand-500 ' +
    'dark:hover:bg-brand-500/10 dark:hover:text-brand-300',
  ghost:
    'text-ink-600 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200 ' +
    'dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white dark:active:bg-ink-700',
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
