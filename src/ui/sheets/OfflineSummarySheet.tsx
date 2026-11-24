import type { OfflineLoadInfo } from '../../engine/resume';
import { OFFLINE_WORKER_FLOOR_SHARE } from '../../data/constants';
import type { GameState } from '../../state/GameState';
import type { SheetController } from '../shell/SheetController';
import { ModalSheet } from '../shell/Sheet';
import { Abbr } from '../primitives/Deco';
import { RESOURCES, type ResourceDef } from '../shell/resourceCatalog';
import { colonyLine } from '../../data/content/colonyLines';
import { formatDeltaFull, formatDuration } from '../../utils/format';
import './OfflineSummarySheet.css';

/**
 * The offline-summary sheet (Story 1.14; Story 2.9: FR23, FR27, UX-DR24).
 *
 * Shown after an offline resume (60 s or more) through the SheetController at
 * `offline` priority, so it opens ahead of anything else. The headline reads
 * `YOU WERE GONE <time>. THE NEST KEPT WORKING.` and takes focus; then the
 * efficiency, every gain and loss (from the before/after states, with the
 * resource glyphs; losses in `warn` with ▼), the warn lines (upkeep outran
 * food, the live cap). It reports only what happened while the player was
 * away: no next move and no shopping suggestion (owner, playtest 2026-11-22).
 * Never empty: the headline and the efficiency are always there.
 *
 * Hooks: `.offline-summary-popup` (panel), `.offline-overlay` (scrim),
 * `.offline-duration`, `.offline-efficiency`, `[data-offline-change=<id>][data-trend]`,
 * `[data-offline-warn=starved]`, `[data-offline-cap]`.
 */

/** Upkeep shorter than this is not worth a line. */
const STARVED_LINE_MIN_MS = 1000;

/** The away time as the sheet reads it (the shared duration formatter). */
export const formatAway = formatDuration;

/** The stocks a summary compares. */
export interface SummaryStocks {
  readonly resources: GameState['resources'];
  readonly combatResources: GameState['combatResources'];
}

/** What the offline summary shows: the resume's numbers and the stocks before and after. */
export interface OfflineSummary {
  readonly info: OfflineLoadInfo;
  readonly before: SummaryStocks;
  readonly after: SummaryStocks;
}

export interface OfflineSummaryOptions {
  onDismiss?: () => void;
}

function amount(s: SummaryStocks, def: ResourceDef): number {
  const store = s[def.store] as unknown as Record<string, number | undefined>;
  const v = store[def.id] ?? 0;
  return Number.isFinite(v) ? Math.floor(v) : 0;
}

/** Each resource whose whole amount changed, in catalog order, with the change. */
export function offlineChanges(before: SummaryStocks, after: SummaryStocks): { def: ResourceDef; delta: number }[] {
  return RESOURCES.map((def) => ({ def, delta: amount(after, def) - amount(before, def) })).filter((c) => c.delta !== 0);
}

export function OfflineSummarySheet({ summary }: { summary: OfflineSummary }) {
  const { info } = summary;
  const changes = offlineChanges(summary.before, summary.after);
  const starved = info.starvedMs >= STARVED_LINE_MIN_MS;
  return (
    <ModalSheet
      headline={
        <>
          YOU WERE GONE <span class="offline-duration">{formatAway(info.elapsedMs).toUpperCase()}</span>. THE NEST KEPT WORKING.
        </>
      }
      class="offline-summary-popup"
      scrimClass="offline-overlay"
      closeLabel="BACK TO THE NEST"
    >
      <p class="offline-efficiency">CATCH-UP EFFICIENCY: {Math.round(info.efficiency * 100)}%</p>
      {changes.length > 0 && (
        <ul class="offline-changes">
          {changes.map(({ def, delta }) => (
            <li key={def.id} data-offline-change={def.id} data-trend={delta > 0 ? 'up' : 'down'}>
              {delta < 0 && <span aria-hidden="true">▼ </span>}
              <span class="offline-changes__glyph" aria-hidden="true">
                <def.glyph />
              </span>{' '}
              <Abbr shown={def.label} full={def.name} /> {formatDeltaFull(delta)}
            </li>
          ))}
        </ul>
      )}
      {starved && (
        <p class="offline-warn" data-offline-warn="starved">
          {colonyLine('offline_starved', { time: formatAway(info.starvedMs) })}
        </p>
      )}
      {(info.starvedEaters ?? 0) > 0 && (
        <p class="offline-warn" data-offline-warn="starved-lost">
          {colonyLine((info.foodRanOutAfterMs ?? 0) > 0 ? 'offline_starved_lost' : 'offline_starved_lost_already', {
            time: formatAway(info.foodRanOutAfterMs ?? 0),
            n: String(info.starvedEaters),
            share: String(Math.round((1 - OFFLINE_WORKER_FLOOR_SHARE) * 100)),
          })}
        </p>
      )}
      {info.capped && (
        <p class="offline-cap offline-warn" data-offline-cap={String(info.capMs)}>
          {colonyLine('offline_cap', { cap: formatAway(info.capMs) })}
        </p>
      )}
    </ModalSheet>
  );
}

/** Request the offline-summary sheet; returns its sheet id. */
export function openOfflineSummary(sheets: SheetController, summary: OfflineSummary, opts: OfflineSummaryOptions = {}): number {
  return sheets.open({
    priority: 'offline',
    render: () => <OfflineSummarySheet summary={summary} />,
    onClose: opts.onDismiss,
  });
}
