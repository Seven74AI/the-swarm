/** A role row's text bar is at most this many cells wide (DESIGN.md → Role row). */
export const BAR_CELLS = 16;

/**
 * The cells of a role row's text bar (Story 1.23): one `█` per worker while
 * the workforce fits in `BAR_CELLS`, then scaled to it. A role with any
 * worker shows at least one filled cell. The bar is as wide as the workforce,
 * up to the limit; the rest of it is `·`.
 */
export function roleBar(count: number, total: number): { filled: number; empty: number } {
  const width = Math.min(BAR_CELLS, Math.max(0, Math.floor(total) || 0));
  const n = Math.min(Math.max(0, Math.floor(count) || 0), Math.max(0, Math.floor(total) || 0));
  if (width === 0) return { filled: 0, empty: 0 };
  const filled = total <= BAR_CELLS ? n : n === 0 ? 0 : Math.min(width, Math.max(1, Math.floor((n * width) / total)));
  return { filled, empty: width - filled };
}
