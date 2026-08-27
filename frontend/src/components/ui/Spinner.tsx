import { cn } from '../../lib/cn';

/**
 * A filling bar rather than a rotating ring — rounded spinners are the one
 * shape this design system does not have. Under reduced motion the bar simply
 * renders full instead of animating.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block h-2.5 w-8 border border-current',
        'bg-[linear-gradient(to_right,currentColor_50%,transparent_50%)] bg-[length:200%_100%]',
        'bg-right bg-no-repeat motion-safe:animate-[taptim-bar_0.9s_steps(6,end)_infinite]',
        'motion-reduce:bg-left',
        className,
      )}
    />
  );
}
