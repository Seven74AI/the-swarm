import { useContext } from 'preact/hooks';
import type { OfflineLoadInfo } from '../../engine/resume';
import type { GameState } from '../../state/GameState';
import type { ReturnMove } from '../../state/selectors';
import type { SheetController } from '../shell/SheetController';
import { ModalSheet, SheetContext } from '../shell/Sheet';
import { Button } from '../primitives/Button';
import { Abbr } from '../primitives/Deco';
import { nextAffordableLine } from '../shell/NextActionButton';
import { RESOURCES, type ResourceDef } from '../shell/resourceCatalog';
import { colonyLine } from '../../data/content/colonyLines';
import { formatDeltaFull } from '../../utils/format';
import './OfflineSummarySheet.css';

/**
 * The offline-summary sheet (Story 1.14; Story 2.9: FR23, FR27, UX-DR24).
 *
 * Shown after an offline resume (60 s or more) through the SheetController at
 * `offline` priority, so it opens ahead of anything else. The headline reads
 * `YOU WERE GONE <time>. THE NEST KEPT WORKING.` and takes focus; then the
 * efficiency, every gain and loss (from the before/after states, with the
 * resource glyphs; losses in `warn` with ▼), the warn lines (upkeep outran
 * food, the live cap), and one next move from the next-action rule
 * (`getReturnMove`): a button that closes the sheet and opens the target's tab,
 * or `NEXT AFFORDABLE: <item> IN ~<time>`. Never empty.
 *
 * Hooks: `.offline-summary-popup` (panel), `.offline-overlay` (scrim),
 * `.offline-duration`, `.offline-efficiency`, `[data-offline-change=<id>][data-trend]`,
 * `[data-offline-warn=starved]`, `[data-offline-cap]`,
 * `button[data-action="offline-next"][data-next-key][data-next-panel]`, `[data-next-action="none"]`.
 */

/** Upkeep shorter than this is not worth a line. */
const STARVED_LINE_MIN_MS = 1000;

/** "45s", "12m 30s", "3h 14m", "8h": a zero minor unit is dropped. */
export function formatAway(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}

/** The stocks a summary compares. */
export interface SummaryStocks {
  readonly resources: GameState['resources'];
  readonly combatResources: GameState['combatResources'];
}

/** What the offline summary shows: the resume's numbers, the stocks before and after, and the next move. */
export interface OfflineSummary {
  readonly info: OfflineLoadInfo;
  readonly before: SummaryStocks;
  readonly after: SummaryStocks;
  /** `getReturnMove(after)`, from main. */
  readonly move: ReturnMove;
}

export interface OfflineSummaryOptions {
  /** The next move was pressed (the sheet is closed first): open its target's tab. */
  onMove?: (move: ReturnMove) => void;
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

function NextMove({ move, onMove }: { move: ReturnMove; onMove?: (move: ReturnMove) => void }) {
  const { close } = useContext(SheetContext);
  if (move.kind !== 'act') return null;
  return (
    <Button
      variant="primary"
      verb={move.verb}
      target={move.target}
      onPress={() => {
        close();
        onMove?.(move);
      }}
      data-action="offline-next"
      data-next-key={move.key}
      data-next-rule={move.rule}
      data-next-panel={move.panel}
    />
  );
}

export function OfflineSummarySheet({ summary, onMove }: { summary: OfflineSummary; onMove?: (move: ReturnMove) => void }) {
  const { info, move } = summary;
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
      action={<NextMove move={move} onMove={onMove} />}
    >
      <p class="offline-efficiency">CATCH-UP EFFICIENCY: {Math.round(info.efficiency * 100)}%</p>
      {changes.length > 0 && (
        <ul class="offline-changes">
          {changes.map(({ def, delta }) => (
            <li key={def.id} data-offline-change={def.id} data-trend={delta > 0 ? 'up' : 'down'}>
              {delta < 0 && <span aria-hidden="true">▼ </span>}
              <span class="offline-changes__glyph" aria-hidden="true">
                {def.glyph}
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
      {info.capped && (
        <p class="offline-cap offline-warn" data-offline-cap={String(info.capMs)}>
          {colonyLine('offline_cap', { cap: formatAway(info.capMs) })}
        </p>
      )}
      {move.kind === 'wait' && (
        <p class="next-affordable" data-next-action="none" data-next-key={move.key}>
          {nextAffordableLine({ kind: 'none', key: move.key, nextAffordable: move })}
        </p>
      )}
    </ModalSheet>
  );
}

/** Request the offline-summary sheet; returns its sheet id. */
export function openOfflineSummary(sheets: SheetController, summary: OfflineSummary, opts: OfflineSummaryOptions = {}): number {
  return sheets.open({
    priority: 'offline',
    render: () => <OfflineSummarySheet summary={summary} onMove={opts.onMove} />,
    onClose: opts.onDismiss,
  });
}
