import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

/**
 * The guided tour.
 *
 * Everything except the current target is dimmed, and the target itself stays
 * clickable — a tour that blocks the thing it is pointing at teaches nothing.
 *
 * The dimming is one element with a 9999px spread shadow, so a single div
 * paints the whole page and leaves a hole exactly around the target's real
 * bounding box. The usual alternative — four rectangles around the hole, or an
 * SVG mask — has to be recomputed on every scroll and gets the corners wrong.
 */

export interface TourStep {
  /** `data-tour` value on the element to highlight. Omit for a centred step. */
  target?: string;
  title: string;
  body: string;
  /** Label for the advance button; defaults to "Next". */
  action?: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

function readRect(target: string): Rect | null {
  const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!element) return null;

  const box = element.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;

  return {
    top: box.top - PADDING,
    left: box.left - PADDING,
    width: box.width + PADDING * 2,
    height: box.height + PADDING * 2,
  };
}

export function TourOverlay({
  steps,
  open,
  onFinish,
  onSkip,
}: {
  steps: TourStep[];
  open: boolean;
  onFinish: () => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  /** Recomputed on scroll and resize so the hole tracks the element. */
  const sync = useCallback(() => {
    if (!open || !step?.target) {
      setRect(null);
      return;
    }
    setRect(readRect(step.target));
  }, [open, step]);

  // Layout effect, not effect: measuring after paint makes the ring visibly
  // jump from the previous target to the new one.
  useLayoutEffect(() => {
    if (!open) return;

    const element = step?.target
      ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      : null;

    if (element) {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      // The rect is only correct once the smooth scroll settles.
      const timer = window.setTimeout(sync, 320);
      return () => window.clearTimeout(timer);
    }

    sync();
  }, [open, step, sync]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [open, sync]);

  // Escape skips, and focus moves to the card so a keyboard user is not left
  // tabbing through a page they cannot see.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKey);
    cardRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, onSkip]);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  if (!open || !step) return null;

  const advance = () => {
    if (isLast) onFinish();
    else setIndex((current) => current + 1);
  };

  /**
   * The card sits below the highlight when there is room, otherwise above.
   * Centred when the step has no target, or the target is not on screen yet.
   */
  const cardStyle: React.CSSProperties = (() => {
    if (!rect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    const below = rect.top + rect.height + 16;
    const fitsBelow = below + 210 < window.innerHeight;
    return {
      top: fitsBelow ? below : Math.max(16, rect.top - 210),
      left: Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - 396)),
    };
  })();

  return (
    <>
      {/*
        When a step has no target, this element still dims the page — it is
        given a zero-size box off-screen so the spread shadow covers everything.
      */}
      <div
        className="spotlight-ring"
        aria-hidden="true"
        style={
          rect
            ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
            : { top: '50%', left: '50%', width: 0, height: 0 }
        }
      />

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        tabIndex={-1}
        style={cardStyle}
        className={cn(
          'fixed z-[80] w-[min(23rem,calc(100vw-2rem))] rounded-[var(--radius-soft-lg)] p-5',
          'border border-iris-500/60 bg-white shadow-[var(--shadow-soft-lg)] outline-none',
          'dark:border-iris-400/50 dark:bg-ink-900',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="type-label text-accent-text">
            Step {index + 1} of {steps.length}
          </p>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {steps.map((entry, position) => (
              <span
                key={entry.title}
                className="pip"
                data-state={
                  position < index ? 'done' : position === index ? 'active' : 'todo'
                }
              />
            ))}
          </div>
        </div>

        <h2 id="tour-title" className="mt-3 text-lg font-bold text-ink-900 dark:text-white">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{step.body}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="type-label cursor-pointer text-ink-500 underline decoration-2 underline-offset-4 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setIndex((c) => c - 1)}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={advance} className={isLast ? '' : 'pulse-cta'}>
              {step.action ?? (isLast ? 'Finish' : 'Next')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
