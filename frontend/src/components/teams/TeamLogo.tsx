import { useState } from 'react';
import { cn } from '../../lib/cn';

/**
 * A team's logo, or a monogram generated from its name.
 *
 * The fallback is derived from the name rather than being one grey placeholder
 * repeated down the page: a roster of five teams should look like five teams
 * even before anyone uploads anything, and a name always maps to the same
 * colour, so a team keeps its identity between pages and sessions.
 */

const PALETTE = [
  ['#4C1D95', '#7C3AED'],
  ['#0F766E', '#14B8A6'],
  ['#1E3A8A', '#3B82F6'],
  ['#9D174D', '#EC4899'],
  ['#7C2D12', '#F97316'],
  ['#312E81', '#6366F1'],
  ['#7F1D1D', '#EF4444'],
  ['#134E4A', '#0EA5E9'],
] as const;

/**
 * A small stable hash of the name.
 *
 * Not for security — it only has to be deterministic and spread names across
 * eight buckets, so a plain rolling sum is enough and needs no dependency.
 */
function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) >>> 0;
  }
  return value;
}

/** Up to two initials — "Kernel Panic" becomes KP, "Nebula" becomes NE. */
function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function TeamLogo({
  name,
  src,
  className,
  /** Tailwind text size for the monogram; the image path ignores it. */
  textClassName = 'text-sm',
}: {
  name: string;
  src: string | null;
  className?: string;
  textClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [from, to] = PALETTE[hash(name) % PALETTE.length];

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-[var(--radius-soft-sm)] object-cover', className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-[var(--radius-soft-sm)] font-bold tracking-tight text-white',
        textClassName,
        className,
      )}
      style={{ backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
    >
      {monogram(name)}
    </span>
  );
}
