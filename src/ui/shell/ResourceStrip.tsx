import { useEffect, useRef, useState } from 'preact/hooks';
import { formatDelta, formatStrip } from '../../utils/format';
import { RESOURCE_BY_ID } from './resourceCatalog';
import { Abbr } from '../primitives/Deco';
import { stripCells, STRIP_CELLS, type ResourceFeed, type ResourceRow } from './resourceFeed';
import type { SheetController } from './SheetController';
import { openResourceSheet } from '../sheets/ResourceSheet';
import { gridClass, useGridCols } from '../primitives/charGrid';
import './ResourceStrip.css';

/**
 * `ui/shell/ResourceStrip` (Story 1.16; UX-DR7, DESIGN.md → Resource strip).
 *
 * Five equal cells: glyph, label (at most 4 letters; the full word is the
 * accessible name), value (`formatStrip`, at most 5 characters) and delta
 * (`formatDelta`: no `/s`, negatives in `warn` with `−`). A capped value turns
 * `warn` with ▲. Values come from the shared `ResourceFeed`, so the strip
 * redraws at most 4 times a second. Above about 125% text scale, or below 28
 * columns of the character grid (Story 1.31), it shows 3
 * cells (capped or falling first) plus a `+N ▸` cell. The whole strip is one
 * button that opens the resource sheet.
 *
 * Hooks: `[data-resource-strip]`, `[data-strip-cell=<id>]` with the legacy
 * `data-stat="<store>.<id>"` and `.critical-value` (E2E specs read those),
 * `[data-value]`, `[data-delta][data-trend=up|down|flat]`, `[data-capped]`,
 * `[data-strip-more]`, `[data-flash]` (deltas flashing after a short return).
 */

/** How long the strip's deltas flash after a short return (Story 2.9, UX-DR43): one flash. */
export const STRIP_FLASH_MS = 600;

/** True for `STRIP_FLASH_MS` after each change of `count` (a new flash restarts it). */
function useFlash(count: number): boolean {
  const [on, setOn] = useState(false);
  const first = useRef(count);
  useEffect(() => {
    if (count === first.current) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), STRIP_FLASH_MS);
    return () => clearTimeout(t);
  }, [count]);
  return on;
}

/** Text scale above which the strip narrows to 3 cells. */
export const LARGE_TEXT_SCALE = 1.25;
/** Cells shown at large text, before the `+N ▸` cell. */
export const COMPACT_CELLS = 3;

/** Current text scale: the root font size against the 16 px default. */
export function textScale(): number {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return 1;
  const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(px) && px > 0 ? px / 16 : 1;
}

function useLargeText(): boolean {
  const [large, setLarge] = useState(() => textScale() > LARGE_TEXT_SCALE);
  useEffect(() => {
    const check = () => setLarge(textScale() > LARGE_TEXT_SCALE);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return large;
}

export interface ResourceStripProps {
  feed: ResourceFeed;
  sheets: SheetController;
  /** Opens the settings screen from the resource sheet (Story 1.27). */
  onOpenSettings?: () => void;
  /** Force the 3-cell layout on or off; by default it follows the text scale. */
  compact?: boolean;
}

function trendOf(rate: number): 'up' | 'down' | 'flat' {
  return rate > 0 ? 'up' : rate < 0 ? 'down' : 'flat';
}

function Cell({ row }: { row: ResourceRow }) {
  const def = RESOURCE_BY_ID[row.id];
  return (
    <span
      class="strip-cell"
      data-strip-cell={row.id}
      data-stat={`${def.store}.${row.id}`}
      data-capped={String(row.capped)}
    >
      <span class="strip-cell__head">
        <span class="strip-cell__glyph" data-glyph="" aria-hidden="true">
          {def.glyph}
        </span>
        <span class="strip-cell__label" data-label="" aria-hidden="true">
          {def.label}
        </span>
        <span class="visually-hidden" data-name="">
          {def.name}
        </span>
      </span>
      <span class="strip-cell__value">
        <span class="critical-value" data-value="">
          {formatStrip(row.amount)}
        </span>
        {row.capped && (
          <span class="strip-cell__cap">
            <Abbr shown="▲" full="capped" />
          </span>
        )}
      </span>
      <span class="strip-cell__delta" data-delta="" data-trend={trendOf(row.rate)}>
        {formatDelta(row.rate)}
      </span>
    </span>
  );
}

export function ResourceStrip({ feed, sheets, onOpenSettings, compact }: ResourceStripProps) {
  const large = useLargeText();
  // Below 28 columns of the character grid (Story 1.31) the strip narrows too.
  const narrowGrid = gridClass(useGridCols()) === 'narrow';
  const narrow = compact ?? (large || narrowGrid);
  useEffect(() => feed.retain(), [feed]);
  const flashing = useFlash(feed.flashes.value);

  const snapshot = feed.snapshot.value;
  const ids = stripCells(snapshot, STRIP_CELLS);
  const shown = narrow ? stripCells(snapshot, COMPACT_CELLS) : ids;
  const hidden = ids.length - shown.length;
  const byId = new Map(snapshot.rows.map((r) => [r.id, r]));

  return (
    <button
      type="button"
      class="resource-strip"
      data-resource-strip=""
      data-compact={String(narrow)}
      data-flash={flashing ? '' : undefined}
      onClick={() => openResourceSheet(sheets, feed, { onOpenSettings })}
    >
      {shown.map((id) => (
        <Cell key={id} row={byId.get(id)!} />
      ))}
      {hidden > 0 && (
        <span class="strip-cell strip-cell--more" data-strip-more="">
          <span aria-hidden="true">{`+${hidden} ▸`}</span>
          <span class="visually-hidden">{`${hidden} more`}</span>
        </span>
      )}
      <span class="visually-hidden">Show all resources</span>
    </button>
  );
}
