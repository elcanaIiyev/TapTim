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

/** Elements that take over typing, so landing on one ends the mode. */
const TEXT_ENTRY = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

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
 * Every target on the page, in document coordinates.
 *
 * Document rather than viewport coordinates on purpose: "down" has to mean the
 * next thing down the *page*, including things below the fold, or the mode
 * would stop at the bottom of the window and refuse to go further.
 */
function collectBoxes(): Box[] {
  // A modal makes the rest of the page inert, so navigation has to stay inside
  // it — otherwise the cursor wanders behind the overlay onto things the
  // person cannot see or click.
  const modal = document.querySelector<HTMLElement>('[aria-modal="true"]');
  const root: ParentNode = modal ?? document;

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

    const left = rect.left + window.scrollX;
    const top = rect.top + window.scrollY;
    boxes.push({
      el,
      left,
      top,
      right: left + rect.width,
      bottom: top + rect.height,
      cx: left + rect.width / 2,
      cy: top + rect.height / 2,
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

  return forward + drift * (overlap > 0 ? 0.35 : 2.5);
}

export function NavigationMode() {
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [label, setLabel] = useState('');
  const targetRef = useRef<HTMLElement | null>(null);
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
      el.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: reduceMotion.current ? 'auto' : 'smooth',
      });
      setLabel(
        (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || 'Element')
          .trim()
          .slice(0, 80),
      );
      syncCursor();
    },
    [syncCursor],
  );

  /**
   * Where the cursor starts: the first target at or below the top of the
   * viewport — what the reader is actually looking at, rather than the top of
   * a page they have already scrolled past.
   */
  const seed = useCallback(() => {
    const boxes = collectBoxes();
    if (boxes.length === 0) return;

    const viewTop = window.scrollY;
    const start =
      boxes.filter((box) => box.bottom > viewTop).sort((a, b) => a.top - b.top || a.left - b.left)[0] ??
      boxes[0];
    focusTarget(start.el);
  }, [focusTarget]);

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
  }, []);

  const move = useCallback(
    (dir: Direction) => {
      const current = targetRef.current;
      const boxes = collectBoxes();
      if (boxes.length === 0) return;

      const from = boxes.find((box) => box.el === current);
      if (!from) {
        focusTarget(boxes[0].el);
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
      // Nothing that way: stay put rather than wrapping. Wrapping from the
      // bottom of a long page back to the top with no warning is disorienting.
      if (!best) return;

      focusTarget(best.el);
    },
    [focusTarget],
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
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncCursor();
      });
    };
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [active, syncCursor]);

  // A navigation replaces every target on the page. Re-seed rather than leave
  // the cursor pointing at a detached node.
  useEffect(() => {
    if (!active) return;
    targetRef.current = null;
    setRect(null);
    // One frame, so the new route has rendered before anything is measured.
    const timer = window.setTimeout(seed, 60);
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
