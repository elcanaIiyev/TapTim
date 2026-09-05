import { useState } from 'react';
import { cn } from '../../lib/cn';

/**
 * An event's cover image, with a designed fallback rather than a broken one.
 *
 * Covers come from an external CDN, so they can be missing, slow, or dead. Three
 * things follow from that:
 *
 * - Every event has a **generated cover** keyed on its format, painted
 *   underneath the photo. A card with no image still looks intentional, and two
 *   events in the same format look related rather than identical.
 * - A failed load falls back to that cover instead of the browser's broken-image
 *   glyph, which is the whole reason this is a component and not an `<img>`.
 * - The photo fades in when it decodes. Without that, a slow image pops in and
 *   the card visibly reflows under the reader's eye.
 */

/**
 * Two stops per format, dark enough that white text sits on them safely.
 *
 * Hand-picked rather than hashed from the name: a hash gives you mud about a
 * third of the time, and there are only six formats to choose for.
 */
const FORMAT_GRADIENT: Record<string, [string, string]> = {
  Hackathon: ['#4C1D95', '#7C3AED'],
  Jam: ['#7C2D12', '#F97316'],
  'Capture the Flag': ['#7F1D1D', '#EF4444'],
  'Competitive contest': ['#1E3A8A', '#3B82F6'],
  Sprint: ['#9D174D', '#EC4899'],
  'Startup weekend': ['#78350F', '#F59E0B'],
};

const FALLBACK_GRADIENT: [string, string] = ['#1F2937', '#4B5563'];

function gradientFor(format: string): [string, string] {
  return FORMAT_GRADIENT[format] ?? FALLBACK_GRADIENT;
}

export function EventCover({
  name,
  format,
  src,
  className,
  /** Cards render many at once; the detail hero is the one worth prioritising. */
  priority = false,
}: {
  name: string;
  format: string;
  src: string | null;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [from, to] = gradientFor(format);
  const showPhoto = Boolean(src) && !failed;

  return (
    <div
      className={cn('relative overflow-hidden bg-ink-900', className)}
      style={{ backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
    >
      {/* A faint grid over the gradient, so the generated cover reads as a
          designed surface rather than a flat colour swatch. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,.6) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {showPhoto && (
        <img
          src={src ?? undefined}
          // Decorative: the event name is already the card's heading, so
          // announcing it twice only adds noise for a screen reader.
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}

      {/* Darkened at the foot so anything overlaid stays readable whether the
          photo behind it is a night shot or a white desk. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent"
      />

      {/* Only shown when there is no photo — otherwise the format is already
          on a badge over the image. */}
      {!showPhoto && (
        <span className="absolute bottom-3 left-4 font-mono text-xs font-semibold uppercase tracking-widest text-white/80">
          {format}
        </span>
      )}

      <span className="sr-only">{name}</span>
    </div>
  );
}
