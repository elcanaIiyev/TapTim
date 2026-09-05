import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';

/**
 * A full-screen curtain for moments where the app changes underneath someone.
 *
 * Signing out is the case this was built for. Clearing a token takes no time at
 * all, so the screen used to swap from a signed-in dashboard to the landing page
 * between two frames — which reads less like "that worked" and more like the
 * page crashed and reloaded.
 *
 * Honest about what it is: there is nothing to wait for here, so this is a
 * deliberate transition rather than progress. It is kept short for that reason,
 * and it always says what is happening rather than showing a bare spinner that
 * implies work nobody is doing.
 *
 * Under `prefers-reduced-motion` the moving parts stop and the veil simply
 * appears — the message still lands, without the sweep.
 */
export function TransitionVeil({
  message,
  sub,
}: {
  message: string;
  sub?: string;
}) {
  // Mounted first, painted second, so the fade actually runs. Setting the final
  // state in the same frame as the mount means the browser never sees the
  // starting state and the transition is skipped entirely.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-0 z-[100] grid place-items-center bg-ink-950 transition-opacity duration-200',
        shown ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div className="grid-floor pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-[var(--radius-soft-sm)] bg-iris-600 text-xl font-bold text-white">
          T
        </span>

        <div>
          <p className="type-label text-white">{message}</p>
          {sub && <p className="mt-2 text-sm text-ink-400">{sub}</p>}
        </div>

        {/* A sweeping bar rather than a ring — the design system has no round
            spinner, and this matches the one in `Spinner`. */}
        <span
          aria-hidden="true"
          className="relative h-1 w-44 overflow-hidden rounded-full bg-ink-800"
        >
          <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-iris-500 motion-safe:animate-[taptim-sweep_1s_ease-in-out_infinite] motion-reduce:w-full" />
        </span>
      </div>
    </div>
  );
}
