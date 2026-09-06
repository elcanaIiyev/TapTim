import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Keyboard navigation mode.
 *
 * Tab order is a single list: it walks the DOM, so getting from a card in the
 * top-left of a grid to one in the bottom-right means pressing Tab through
 * everything in between. This is the other model — the page as a plane, moved
 * across with WASD or the arrow keys, Enter to act.
 *
 * ## The hotkey
 *
 * There is no cross-web standard for entering a mode like this, so rather than
 * inventing one and hoping, both of the near-standards are accepted:
 *
 * - **F7** is the browser's own toggle for caret browsing — "move through this
 *   page with the arrow keys" — which is the closest thing to a real
 *   convention. Its default is suppressed so Chrome does not also raise its
 *   own caret-browsing prompt on top of this.
 * - **`** (backtick) is the console/mode key every game uses, which is where
 *   WASD comes from in the first place, and it is reachable without a stretch.
 *
 * Escape leaves. So does Tab, which hands control back to the browser's own
 * focus order rather than fighting it.
 *
 * ## The cursor cannot reach what you cannot see
 *
 * The first version measured every target in *document* coordinates, reasoning
 * that "down" should mean down the page rather than down the window. It did —
 * and it also meant the cursor could land on a control that had been scrolled
 * off the top of the screen, or on one sitting underneath the sticky header,
 * where Enter activated something invisible.
 *
 * The header made that worse rather than better. Sticky positioning gives it
 * viewport coordinates that overlap whatever is scrolled beneath it, so in
 * document space the bar and the content hidden behind it occupied the same
 * band, and the cursor jumped between the two.
 *
 * Targets are therefore measured in viewport coordinates and filtered twice:
 *
 * 1. **Visibility** — the box has to intersect the part of the window actually
 *    showing page content, which is the viewport minus whatever the sticky
 *    header covers.
 * 2. **Occlusion** — `elementFromPoint` has to agree that the element is what
 *    is painted there. That excludes anything behind the header, the chat
 *    dock, or an overlay, without this file needing to know they exist.
 *
 * Travelling past the fold becomes a separate motion: when nothing is left in
 * the direction pressed, the page scrolls by most of a screen and the cursor
 * re-seeds into what that reveals. Reaching a thing costs bringing it into
 * view, which is the property that was missing.
 *
 * ## Text fields
 *
 * The invariant is that nothing typed in this mode ever reaches a text field,
 * and nothing typed in a text field ever reaches this mode.
 *
 * Fields are ordinary targets — the cursor moves over them like anything else,
 * because a search box near the top of a page must not be a wall you cannot
 * navigate past — but landing on one does not focus it, so a stray keystroke
 * has nowhere to land. Enter is what commits: it focuses the field and ends
 * the mode, because somebody who deliberately opened a text box wants to type
 * in it. Going the other way, the toggle is ignored while a field has focus,
 * so a backtick typed into a message is a backtick.
 */

type Direction = 'up' | 'down' | 'left' | 'right';

const MOVE_KEYS: Record<string, Direction> = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

/** Everything a person could plausibly want to land on. */
const SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[role="tab"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Elements that take over typing, so the cursor passes over without focusing. */
const TEXT_ENTRY = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Breathing room kept between a target and the edges of the visible band. */
const EDGE_PADDING = 8;

/** How much of a screen one scroll step covers when the cursor runs out of page. */
const SCROLL_STEP = 0.7;

/**
 * How far off the axis a candidate may sit, as a multiple of how far along the
 * axis it is, when the two boxes share no cross-axis overlap. Roughly a 70°
 * cone — permissive enough for the diagonal steps a real layout produces, tight
 * enough to reject a jump across the whole screen.
 */
const CONE_RATIO = 3;

interface Box {
  el: HTMLElement;
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
}

function isTypingTarget(node: EventTarget | null): boolean {
  const el = node as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return TEXT_ENTRY.has(el.tagName) || el.isContentEditable;
}

/**
 * The band of the window that is showing page content.
 *
 * The sticky header covers the top of it, and anything under the header is not
 * visible however innocent its coordinates look.
 */
function visibleBand(): { top: number; bottom: number; header: HTMLElement | null } {
  const header = document.querySelector<HTMLElement>('header');
  const covered =
    header && window.getComputedStyle(header).position === 'sticky'
      ? Math.max(0, header.getBoundingClientRect().bottom)
      : 0;
  return { top: covered, bottom: window.innerHeight, header };
}

/**
 * Whether `el` is what is actually painted at its own position.
 *
 * The probe has to land inside the element's *visible slice*, not at its
 * geometric centre and not at an arbitrary point in the band. Getting that
 * wrong is subtle in both directions: a card half-covered by the header has a
 * centre that is underneath the header, and a control inside the sticky bar
 * lives entirely above the band, so clamping the sample into the band made
 * every one of the bar's own buttons unreachable.
 *
 * Three samples across rather than one: a wide element's centre often lands on
 * a child, and one near an edge can be clipped.
 */
function isOnTop(
  el: HTMLElement,
  rect: DOMRect,
  band: { top: number; bottom: number },
  inHeader: boolean,
): boolean {
  // The header is painted over the band, so its own contents are visible above
  // it; everything else is only visible below it.
  const lo = inHeader ? 1 : band.top + 1;
  const hi = band.bottom - 1;

  const sliceTop = Math.max(rect.top + 2, lo);
  const sliceBottom = Math.min(rect.bottom - 2, hi);
  if (sliceBottom < sliceTop) return false;

  const y = (sliceTop + sliceBottom) / 2;
  const xs = [rect.left + rect.width / 2, rect.left + 4, rect.right - 4];

  for (const rawX of xs) {
    const x = Math.min(Math.max(rawX, 1), window.innerWidth - 1);
    const hit = document.elementFromPoint(x, y);
    if (hit && (el === hit || el.contains(hit) || hit.contains(el))) return true;
  }
  return false;
}

/** Every target the person can currently see, in viewport coordinates. */
function collectBoxes(): Box[] {
  // A modal makes the rest of the page inert, so navigation has to stay inside
  // it — otherwise the cursor wanders behind the overlay onto things the
  // person cannot see or click.
  const modal = document.querySelector<HTMLElement>('[aria-modal="true"]');
  const root: ParentNode = modal ?? document;
  const band = visibleBand();

  const boxes: Box[] = [];
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(SELECTOR))) {
    if (el.closest('[data-nav-skip]')) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;

    const rect = el.getBoundingClientRect();
    // Zero-sized elements are the sr-only ones and collapsed menus; there is
    // nothing to point a cursor at.
    if (rect.width < 6 || rect.height < 6) continue;

    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;

    // On screen at all.
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
    if (rect.right <= 0 || rect.left >= window.innerWidth) continue;

    // Below the sticky header — unless it *is* the sticky header, whose own
    // controls are visible and have to stay reachable.
    const inHeader = band.header?.contains(el) ?? false;
    if (!inHeader && rect.bottom <= band.top + 2) continue;


    if (!isOnTop(el, rect, band, inHeader)) continue;

    boxes.push({
      el,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    });
  }
  return boxes;
}

/**
 * How bad a candidate is as the next stop in `dir`. Lower wins, Infinity means
 * "not in that direction at all".
 *
 * Distance along the axis of travel, plus a penalty for being off to the side.
 * The penalty is small when the two boxes overlap on the cross axis and large
 * when they do not, which is what makes a grid behave like a grid: pressing
 * down inside a column stays in that column instead of drifting to whatever
 * happens to be nearest in a straight line.
 */
function score(from: Box, to: Box, dir: Direction): number {
  const vertical = dir === 'up' || dir === 'down';

  const forward = vertical
    ? dir === 'down'
      ? to.cy - from.cy
      : from.cy - to.cy
    : dir === 'right'
      ? to.cx - from.cx
      : from.cx - to.cx;
  if (forward <= 1) return Infinity;

  const drift = vertical ? Math.abs(to.cx - from.cx) : Math.abs(to.cy - from.cy);
  const overlap = vertical
    ? Math.min(from.right, to.right) - Math.max(from.left, to.left)
    : Math.min(from.bottom, to.bottom) - Math.max(from.top, to.top);

  // A cone, not a half-plane. Without it the *only* candidate in a direction
  // wins however absurd the angle: pressing right on the last control in the
  // top bar teleported to the floating chat button at the bottom of the
  // screen, two pixels further right and seven hundred pixels down. Boxes that
  // overlap on the cross axis are exempt — they are genuinely in the same row
  // or column however far apart.
  if (overlap <= 0 && drift > forward * CONE_RATIO) return Infinity;

  return forward + drift * (overlap > 0 ? 0.35 : 2.5);
}

export function NavigationMode() {
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [label, setLabel] = useState('');
  const targetRef = useRef<HTMLElement | null>(null);
  /**
   * The pending re-seed after a scroll step.
   *
   * It has to be cancellable. Travelling past the fold scrolls and then re-seeds
   * once the smooth scroll has settled, which is a few hundred milliseconds —
   * long enough for the next keypress to land first. Without this the queued
   * seed fires *after* that move and throws the cursor somewhere the person did
   * not ask for, which reads as the mode randomly losing its place.
   */
  const pendingSeed = useRef(0);
  const { pathname } = useLocation();

  const reduceMotion = useRef(false);
  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  /** Repaints the cursor over whatever is current. */
  const syncCursor = useCallback(() => {
    const el = targetRef.current;
    if (!el || !el.isConnected) {
      setRect(null);
      return;
    }
    setRect(el.getBoundingClientRect());
  }, []);

  /**
   * Nudges a target clear of the sticky header and the bottom edge.
   *
   * `scrollIntoView({ block: 'nearest' })` cannot do this: it aligns to the
   * scrollport, which starts at y=0 and includes the strip the header is
   * painted over, so a target near the top of the page landed under the bar.
   */
  const reveal = useCallback((el: HTMLElement) => {
    const band = visibleBand();
    const box = el.getBoundingClientRect();

    let delta = 0;
    if (box.top < band.top + EDGE_PADDING) delta = box.top - (band.top + EDGE_PADDING);
    else if (box.bottom > band.bottom - EDGE_PADDING) {
      delta = box.bottom - (band.bottom - EDGE_PADDING);
    }

    if (delta !== 0) {
      window.scrollBy({ top: delta, behavior: reduceMotion.current ? 'auto' : 'smooth' });
    }
  }, []);

  const focusTarget = useCallback(
    (el: HTMLElement) => {
      targetRef.current = el;
      if (TEXT_ENTRY.has(el.tagName)) {
        // Passed over, not entered. Focusing it here would put a caret in a
        // box the person has not asked to type in, and every subsequent
        // keystroke would be one preventDefault away from being inserted.
        (document.activeElement as HTMLElement | null)?.blur?.();
      } else {
        // Real DOM focus, not just a painted ring: assistive tech follows it,
        // and it means the element is genuinely the active one if the person
        // leaves the mode mid-way.
        el.focus({ preventScroll: true });
      }
      reveal(el);
      setLabel(
        (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || 'Element')
          .trim()
          .slice(0, 80),
      );
      syncCursor();
    },
    [reveal, syncCursor],
  );

  /**
   * Where the cursor starts: the topmost target currently on screen. Every
   * candidate is visible by construction now, so this is simply the first —
   * or the last, when arriving from below after scrolling up.
   */
  const seed = useCallback(
    (fromBottom = false) => {
      const boxes = collectBoxes();
      if (boxes.length === 0) return;

      const sorted = [...boxes].sort((a, b) => a.top - b.top || a.left - b.left);
      focusTarget((fromBottom ? sorted[sorted.length - 1] : sorted[0]).el);
    },
    [focusTarget],
  );

  const enter = useCallback(() => {
    const boxes = collectBoxes();
    if (boxes.length === 0) return;

    setActive(true);

    // Start from whatever already has focus if it is a target, so toggling the
    // mode on does not throw away where the person was.
    const focused = document.activeElement as HTMLElement | null;
    const fromFocus = focused ? boxes.find((box) => box.el === focused) : undefined;
    if (fromFocus) focusTarget(fromFocus.el);
    else seed();
  }, [focusTarget, seed]);

  const leave = useCallback(() => {
    setActive(false);
    setRect(null);
    targetRef.current = null;
    window.clearTimeout(pendingSeed.current);
    pendingSeed.current = 0;
  }, []);

  const move = useCallback(
    (dir: Direction) => {
      // Whatever the last scroll step queued, this keypress supersedes it.
      window.clearTimeout(pendingSeed.current);
      pendingSeed.current = 0;

      const current = targetRef.current;
      const boxes = collectBoxes();
      if (boxes.length === 0) return;

      const from = boxes.find((box) => box.el === current);
      if (!from) {
        seed();
        return;
      }

      let best: Box | null = null;
      let bestScore = Infinity;
      for (const box of boxes) {
        if (box.el === from.el) continue;
        const value = score(from, box, dir);
        if (value < bestScore) {
          bestScore = value;
          best = box;
        }
      }
      if (best) {
        focusTarget(best.el);
        return;
      }

      // Nothing left on screen that way. Vertically the page has more to show,
      // so travel there — bringing it into view is the cost of reaching it.
      // Horizontally there is nowhere to go, so stay put rather than wrapping,
      // which is disorienting with no warning.
      if (dir !== 'up' && dir !== 'down') return;

      const before = window.scrollY;
      window.scrollBy({
        top: (dir === 'down' ? 1 : -1) * window.innerHeight * SCROLL_STEP,
        behavior: reduceMotion.current ? 'auto' : 'smooth',
      });

      // Re-seed once the scroll settles, entering from the edge the cursor
      // travelled towards: going down lands near the top of what was revealed.
      pendingSeed.current = window.setTimeout(
        () => {
          pendingSeed.current = 0;
          if (window.scrollY === before) return; // already at the end of the page
          seed(dir === 'up');
        },
        reduceMotion.current ? 0 : 320,
      );
    },
    [focusTarget, seed],
  );

  // The global key handler. One listener, capture phase, so it sees the key
  // before anything on the page can act on it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // The toggle. Ignored while a field has focus, so a backtick typed into
      // a message is a backtick — but only when the mode is off, or there
      // would be no way out of a mode entered next to a text box.
      if (key === 'f7' || (key === '`' && !event.ctrlKey && !event.metaKey && !event.altKey)) {
        if (!active && isTypingTarget(event.target)) return;
        event.preventDefault();
        if (active) leave();
        else enter();
        return;
      }

      if (!active) return;

      if (key === 'escape') {
        event.preventDefault();
        leave();
        return;
      }

      // Tab hands control back to the browser's own focus order. Not
      // preventDefault-ed: the point is to let the native move happen.
      if (key === 'tab') {
        leave();
        return;
      }

      if (key === 'enter' || key === ' ') {
        const el = targetRef.current;
        if (!el) return;
        // Suppressed so the native activation does not also fire — Enter on a
        // focused button would otherwise click it twice.
        event.preventDefault();

        // A field is committed to rather than clicked: the mode ends and the
        // caret goes in, which is the only reason to press Enter on one.
        if (TEXT_ENTRY.has(el.tagName)) {
          leave();
          el.focus();
          return;
        }

        el.click();
        // A link that navigates unmounts everything; the route effect below
        // re-seeds the cursor on the page that replaces it.
        return;
      }

      const dir = MOVE_KEYS[key];
      if (!dir) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // Arrow keys and space scroll the page by default, which would fight
      // every move.
      event.preventDefault();
      move(dir);
    };

    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [active, enter, leave, move]);

  // The cursor is painted in viewport coordinates, so it has to follow scroll
  // and resize. rAF-batched: these fire far faster than the paint needs.
  useEffect(() => {
    if (!active) return;
    let frame = 0;

    const settle = () => {
      frame = 0;
      const el = targetRef.current;
      if (el?.isConnected) {
        const band = visibleBand();
        const box = el.getBoundingClientRect();
        const inHeader = band.header?.contains(el) ?? false;
        // A wheel scroll can carry the target off screen or in behind the bar,
        // and a cursor sitting on something invisible is exactly the bug this
        // mode had. Re-seed into whatever is now in front of the person.
        if (!inHeader && (box.bottom <= band.top || box.top >= band.bottom)) {
          seed();
          return;
        }
      }
      syncCursor();
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(settle);
    };

    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [active, seed, syncCursor]);

  // A navigation replaces every target on the page. Re-seed rather than leave
  // the cursor pointing at a detached node.
  useEffect(() => {
    if (!active) return;
    targetRef.current = null;
    setRect(null);
    // One frame, so the new route has rendered before anything is measured.
    const timer = window.setTimeout(() => seed(), 60);
    return () => window.clearTimeout(timer);
    // `active` is deliberately not a trigger here — entering the mode already
    // seeds its own cursor, and re-running this on entry would overwrite it.
  }, [pathname]);

  if (!active) return null;

  return (
    <>
      {rect && (
        <div
          className="nav-cursor"
          aria-hidden="true"
          style={{
            top: rect.top - 3,
            left: rect.left - 3,
            width: rect.width + 6,
            height: rect.height + 6,
          }}
        />
      )}

      {/* The key legend. A mode with no visible rules is a mode nobody uses
          twice, and it doubles as the confirmation that the mode is on. */}
      <div
        data-nav-skip
        className="pointer-events-none fixed bottom-5 left-5 z-[66] max-w-[calc(100vw-2.5rem)] rounded-[var(--radius-soft)] border border-iris-500 bg-ink-950/95 px-4 py-3 text-ink-100 shadow-[var(--shadow-soft-lg)]"
      >
        <p className="type-label flex items-center gap-2 text-iris-300">
          <span className="inline-flex h-2 w-2 rounded-full bg-fern-400" aria-hidden="true" />
          Navigation mode
        </p>
        <p className="mt-2 text-xs text-ink-300">
          <span className="readout text-ink-100">WASD</span> or{' '}
          <span className="readout text-ink-100">arrows</span> to move ·{' '}
          <span className="readout text-ink-100">Enter</span> to open ·{' '}
          <span className="readout text-ink-100">Esc</span> to leave
        </p>
        {label && <p className="mt-1.5 truncate text-xs font-semibold text-white">{label}</p>}
      </div>

      <p aria-live="polite" className="sr-only">
        {label}
      </p>
    </>
  );
}
