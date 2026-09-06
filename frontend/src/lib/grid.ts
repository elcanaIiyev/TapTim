/**
 * How wide a grid should be for the number of things actually in it.
 *
 * A three-column grid holding three cards is a row with two gaps in it; holding
 * one, it is a card in the top-left corner of a lot of nothing. Neither is
 * broken and both read as under-filled, which is the cold-start problem showing
 * up visually rather than statistically — and it is the version of it a
 * first-time visitor meets in the first four seconds, before any of the
 * matching has had a chance to be impressive.
 *
 * So the grid narrows to fit. One item is a single wide row, two is a pair, and
 * only a genuinely full set gets the three-column treatment. The page then
 * looks composed at every count instead of looking like a page waiting for
 * content that never arrived.
 */
export function fittedGrid(count: number, max: 2 | 3 | 4 = 3): string {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
  if (max === 2) return 'grid-cols-1 sm:grid-cols-2';
  if (max >= 4 && count >= 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
}

/**
 * Whether a set is small enough that a grid is the wrong shape for it entirely.
 *
 * Below this, cards laid side by side have to be narrow for no reason — there
 * is nothing to their right. A single column of wider rows carries the same
 * information and looks like a decision.
 */
export function preferList(count: number): boolean {
  return count > 0 && count <= 2;
}
