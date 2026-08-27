import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

// `cursor-pointer` is explicit: browsers default <button> to an arrow cursor,
// and Tailwind v4's preflight no longer overrides it.
//
// Brutalist buttons are hard rectangles with a 2px frame. Instead of lifting on
// hover they travel into their own offset shadow (`brut-press`), which reads as
// a physical key press rather than the usual float-and-glow.
const BASE =
  'group/btn relative inline-flex cursor-pointer select-none items-center justify-center gap-2 ' +
  'border-2 font-semibold uppercase tracking-[0.08em] whitespace-nowrap ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none';

const VARIANTS: Record<Variant, string> = {
  // Near-black on safety orange, not white: white only reaches 3.56:1 here,
  // while ink-950 gives 5.56:1 (7.06:1 on the flame-500 hover). This is also
  // what the generated design system specifies as "On Accent".
  primary:
    'brut-press brut-shadow border-ink-950 bg-flame-600 text-ink-950 hover:bg-flame-500 ' +
    'dark:border-ink-100',
  secondary:
    'brut-press brut-shadow border-ink-950 bg-ink-950 text-ink-50 hover:bg-ink-800 ' +
    'dark:border-ink-100 dark:bg-ink-100 dark:text-ink-950 dark:hover:bg-white',
  outline:
    'brut-press brut-shadow border-ink-950 bg-white text-ink-950 hover:bg-flame-50 ' +
    'dark:border-ink-100 dark:bg-ink-900 dark:text-ink-100 dark:hover:bg-ink-800',
  // The one non-boxed variant, for tertiary actions inside dense toolbars.
  ghost:
    'border-transparent text-ink-700 transition-colors duration-150 hover:border-ink-950 ' +
    'hover:bg-ink-950 hover:text-ink-50 dark:text-ink-300 dark:hover:border-ink-100 ' +
    'dark:hover:bg-ink-100 dark:hover:text-ink-950',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[0.6875rem]',
  md: 'h-11 px-5 text-xs',
  lg: 'h-14 px-8 text-sm',
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
