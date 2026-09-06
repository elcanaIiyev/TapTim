import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

/**
 * The wordmark, alone.
 *
 * It used to be a square block with a knocked-out figure beside the name — a
 * generic app-icon-plus-title lockup, and the icon was doing no work the word
 * was not already doing. Removing it leaves the name to carry the mark, so the
 * name has to be worth looking at: very tight tracking, heavy weight, and a
 * rule that starts under the accented half and runs the whole width on hover.
 *
 * The old comment here said the mark had no rounding because "the logo has to
 * carry the same rules as everything else". That was true of a system built on
 * hard corners; it is not true of this one. The nav links were the other
 * holdout and they are a rounded rail now, which left a square mark sitting
 * beside them looking unmigrated rather than deliberate. The rule under the
 * word is rounded for the same reason.
 *
 * The rule is the only moving part. One gesture reads as considered; a logo
 * that also scales, glows and changes colour reads as a template with the
 * effects turned up.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="TapTim home"
      className={cn('group/logo relative inline-block leading-none', className)}
    >
      <span className="text-[1.4rem] font-extrabold tracking-[-0.055em] text-ink-900 dark:text-white">
        Tap<span className="text-accent-text">Tim</span>
      </span>

      {/*
        Anchored right and sized to roughly the width of "Tim", so at rest the
        rule sits under the accented half and reads as part of it. Growing
        leftwards on hover is what makes it one word rather than two.
      */}
      <span
        aria-hidden="true"
        className="absolute -bottom-1.5 right-0 h-[3px] w-[47%] rounded-full bg-iris-600 transition-[width] duration-[var(--duration-settled)] ease-[var(--ease-soft)] group-hover/logo:w-full dark:bg-iris-400"
      />
    </Link>
  );
}
