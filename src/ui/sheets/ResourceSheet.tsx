import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatDuration, formatFull, formatSheetRate } from '../../utils/format';
import { Button } from '../primitives/Button';
import { ModalSheet } from '../shell/Sheet';
import type { SheetController } from '../shell/SheetController';
import { GEAR_GLYPH, RESOURCE_BY_ID, type ResourceId } from '../shell/resourceCatalog';
import type { ResourceFeed, ResourceRow } from '../shell/resourceFeed';
import { selectFoodLimitLine, selectFoodParts, selectRunLosses, selectSettlesLine, selectFoodRatePerSec, selectPhase, selectResourceFlows, selectResources, selectSeenResources, selectVerdict } from '../../state/selectors';
import { foodSpentSince } from './foodLedger';
import { Phase } from '../../phases/phases';
import { HOUR_MS } from '../../data/constants';
import { sheetBalance } from '../../data/balance/sheet';
import type { VerdictFix, VerdictKind } from '../../data/content/verdicts';
import { sheetOpened, type SheetMoment } from './sheetSince';
import { useThrottledSignal } from '../primitives/throttledSignal';
import { REFRESH_MS } from '../shell/resourceFeed';
import { formatDeltaFull } from '../../utils/format';
import { sheetLayout, needsALook, type SheetGroup } from './resourceSheetLayout';
import { Sep, decorate } from '../primitives/Deco';
import './ResourceSheet.css';

/**
 * The resource sheet (Story 1.16; Story 9.10: UX-DR8 changed, DESIGN.md →
 * Resource sheet).
 *
 * Opened by a tap on the resource strip, through the SheetController as an
 * ordinary modal. Every unlocked resource on two short lines: glyph, full
 * name and the exact integer (`formatFull`); then, dim, its rate (per second
 * from 1 a second, else per minute: `formatSheetRate`), its source and a text
 * sparkline of the last 10 minutes. A cap shows only where one exists, as a
 * fill meter. Falling or capped resources come first; past
 * `sheetBalance.groupAfterRows` rows they group by tier, collapsed unless a
 * group holds a falling or capped resource (`sheetLayout`). A resource
 * unlocked since the sheet last closed reads `NEW` until it closes
 * (`state.seenResources`, once per resource per run). A tap on a row opens its
 * peek: where it comes from and what spends it (`resourceFlows`).
 * `[ SETTINGS gear ]` sits at the bottom, so settings are reachable from
 * Phase 1.
 *
 * It reads the same `ResourceFeed` as the strip, so it refreshes at most 4
 * times a second. Hooks: `[data-resource-sheet]`, `[data-resource-header]`,
 * `[data-resource-list]`, `[data-resource-group=<tier>][data-open]`,
 * `[data-resource-row=<id>][data-capped][data-new]` with
 * `[data-col=name|amount|rate|cap|source|spark]`, `[data-resource-peek=<id>]`,
 * `[data-action="settings"]`.
 */

export interface ResourceSheetOptions {
  /** Opens the settings screen; the resource sheet closes first. */
  onOpenSettings?: () => void;
  /** The sheet closed having shown these resources (Story 9.10: `actions.markResourcesSeen`). */
  onSeen?: (ids: readonly string[]) => void;
  /** The verdict line was tapped (Story 9.11): open the screen that fixes it. The sheet closes first. */
  /** `fix` (Story 9.17): the screen a hunger verdict opens, WRKR's Gather or NEST's room jobs. */
  onVerdict?: (kind: VerdictKind, fix?: VerdictFix) => void;
  /** A name in the food block was tapped (Story 9.12): its WRKR row, or WAR for soldiers. The sheet closes first. */
  onFoodJump?: (target: FoodJump) => void;
}

/** What a name in the food block opens (Story 9.12). */
export type FoodJump = 'gather' | 'idle' | 'workers' | 'soldiers';


export const SETTINGS_NOT_READY = 'Settings are not available yet';
const METER_CELLS = 6;

function CapMeter({ row }: { row: ResourceRow }) {
  const cap = row.cap ?? 0;
  const pct = cap > 0 ? Math.min(100, Math.floor((row.amount * 100) / cap)) : 0;
  const filled = Math.round((pct * METER_CELLS) / 100);
  return (
    <span class="resource-row__cap" data-col="cap">
      <span aria-hidden="true">
        {'█'.repeat(filled)}
        {'·'.repeat(METER_CELLS - filled)} {pct}%
      </span>
      <span class="visually-hidden">
        {pct} percent of {formatFull(cap)}
      </span>
    </span>
  );
}

function Row({ row, isNew, open, onToggle }: { row: ResourceRow; isNew: boolean; open: boolean; onToggle: () => void }) {
  const def = RESOURCE_BY_ID[row.id];
  const flows = open ? selectResourceFlows(row.id).value : null;
  return (
    <li class="resource-row" data-resource-row={row.id} data-capped={String(row.capped)} data-new={isNew ? '' : undefined}>
      <button type="button" class="resource-row__open" aria-expanded={open ? 'true' : 'false'} data-action="resource-peek" onClick={onToggle}>
        <span class="resource-row__line" data-line="1">
          <span class="resource-row__glyph" data-glyph="" aria-hidden="true">
            <def.glyph />
          </span>
          <span class="resource-row__name" data-col="name">
            {def.name}
          </span>
          {isNew && (
            <span class="resource-row__new" data-new-mark="">
              NEW
            </span>
          )}
          {row.cap !== null && <CapMeter row={row} />}
          <span class="resource-row__amount" data-col="amount">
            {formatFull(row.amount)}
          </span>
        </span>
        <span class="resource-row__line resource-row__line--dim" data-line="2">
          <span class="resource-row__rate" data-col="rate" data-trend={row.ratePerSec > 0 ? 'up' : row.ratePerSec < 0 ? 'down' : 'flat'}>
            {formatSheetRate(row.ratePerSec)}
          </span>
          <Sep />
          <span class="resource-row__source" data-col="source">
            {def.source}
          </span>
          {row.spark && (
            <>
              <Sep />
              <span class="resource-row__spark" data-col="spark" aria-hidden="true">
                {row.spark}
              </span>
            </>
          )}
        </span>
      </button>
      {flows && (
        <div class="resource-row__peek" data-resource-peek={row.id}>
          <p>
            COMES FROM: <span data-peek="from">{flows.from.join(', ') || 'NOTHING YET'}</span>
          </p>
          <p>
            SPENT ON: <span data-peek="spent">{flows.spentOn.join(', ') || 'NOTHING YET'}</span>
          </p>
        </div>
      )}
    </li>
  );
}

/** `14:02`: wall-clock hours and minutes, two digits each. */
const clock = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * The verdict line (Story 9.11, UX-DR50): the worst current state, a button
 * that opens the screen that fixes it, only on its own tap (FR27). Falling
 * reads in `warn`. Hook: `button[data-verdict=starving|food|limit|nest|growing][data-warn]`; under a
 * starving or falling verdict, `[data-settles]` says where the colony settles (Story 9.17).
 */
function VerdictLine({ onVerdict, close }: { onVerdict?: (kind: VerdictKind, fix?: VerdictFix) => void; close: () => void }) {
  const { verdict, text } = useThrottledSignal(selectVerdict, REFRESH_MS).value;
  const settles = useThrottledSignal(selectSettlesLine, REFRESH_MS).value;
  return (
    <button
      type="button"
      class="resource-sheet__verdict"
      data-verdict={verdict.kind}
      data-warn={verdict.warn ? '' : undefined}
      onClick={() => {
        if (verdict.kind === 'growing') return;
        close();
        onVerdict?.(verdict.kind, 'fix' in verdict ? (verdict.fix ?? undefined) : undefined);
      }}
    >
      {decorate(text)}
      {settles && (
        <span class="resource-sheet__settles" data-settles="">
          {settles}
        </span>
      )}
    </button>
  );
}

/** `FOOD +1 204 SINCE 14:02 · NET WAS −3/S, NOW +2/S` (Story 9.11): only from the session's second opening. */
function SinceLine({ before, now }: { before: SheetMoment; now: SheetMoment }) {
  return (
    <p class="resource-sheet__since" data-since="">
      FOOD {formatDeltaFull(now.food - before.food)} SINCE {clock(before.atMs)}
      <Sep />
      NET WAS {formatSheetRate(before.netPerSec)}, NOW {formatSheetRate(now.netPerSec)}
    </p>
  );
}

/**
 * The food block (Story 9.12, UX-DR51), under the verdict from Colony on:
 * `FOOD IN +n/S ← gatherers n · idle n`, `EATEN −n/S → workers n · soldiers n`,
 * `SPENT THIS HOUR: <item> n · …` (the session's one-off spends) and
 * `ONE GATHERER FEEDS <n>.`, from `selectFoodParts`: IN − EATEN is WRKR's net.
 * Each name is a button to its WRKR row, or WAR for soldiers.
 */
function FoodBlock({ onFoodJump, close }: { onFoodJump?: (t: FoodJump) => void; close: () => void }) {
  const p = useThrottledSignal(selectFoodParts, REFRESH_MS).value;
  const [spent] = useState(() => foodSpentSince(Date.now() - HOUR_MS));
  const limitLine = useThrottledSignal(selectFoodLimitLine, REFRESH_MS).value;
  const losses = useThrottledSignal(selectRunLosses, REFRESH_MS).value;
  const name = (target: FoodJump, label: string, n: number) => (
    <button
      type="button"
      class="food-block__name"
      data-food-jump={target}
      onClick={() => {
        close();
        onFoodJump?.(target);
      }}
    >
      {label} {formatFull(n)}
    </button>
  );
  return (
    <div class="food-block" data-food-block="">
      <p data-food="in">
        FOOD IN {formatSheetRate(p.in.total)} <span aria-hidden="true">←</span>
        <span class="visually-hidden">from</span> {name('gather', 'gatherers', p.counts.gatherers)}
        <Sep />
        {name('idle', 'idle', p.counts.idle)}
      </p>
      <p data-food="eaten">
        EATEN {formatSheetRate(-p.eaten.total)} <span aria-hidden="true">→</span>
        <span class="visually-hidden">by</span> {name('workers', 'workers', p.counts.workers)}
        <Sep />
        {name('soldiers', 'soldiers', p.counts.soldiers)}
      </p>
      <p data-food="limit">
        {limitLine.split(' · ').map((part, i) => (
          <Fragment key={part}>
            {i > 0 && <Sep />}
            {part}
          </Fragment>
        ))}
      </p>
      {losses.starvedWorkers + losses.starvedSoldiers > 0 && (
        <p data-food="hunger">
          LOST TO HUNGER: {formatFull(losses.starvedWorkers)} WORKERS
          <Sep />
          {formatFull(losses.starvedSoldiers)} SOLDIERS
        </p>
      )}
      {losses.lostAtLimit > 0 && <p data-food="lost-limit">LOST AT THE LIMIT {formatFull(losses.lostAtLimit)}</p>}
      <p data-food="spent">
        SPENT THIS HOUR:{' '}
        {spent.length === 0
          ? 'NOTHING'
          : spent.map((s, i) => (
              <>
                {i > 0 && <Sep />}
                {s.label} {formatFull(s.amount)}
              </>
            ))}
      </p>
      <p data-food="feeds">ONE GATHERER FEEDS {formatFull(p.oneGathererFeeds)}.</p>
    </div>
  );
}

function Group({ group, fresh, peek, setPeek }: { group: SheetGroup; fresh: ReadonlySet<string>; peek: ResourceId | null; setPeek: (id: ResourceId | null) => void }) {
  const [shown, setShown] = useState(group.open);
  // A group that comes to hold a falling or capped resource opens; the player's own toggle stays otherwise.
  useEffect(() => {
    if (group.open) setShown(true);
  }, [group.open]);
  const items = group.rows.map((row) => (
    <Row key={row.id} row={row} isNew={fresh.has(row.id)} open={peek === row.id} onToggle={() => setPeek(peek === row.id ? null : row.id)} />
  ));
  if (group.label === null) return <>{items}</>;
  const rows = (
    <ul class="resource-sheet__rows" hidden={!shown}>
      {items}
    </ul>
  );
  return (
    <li class="resource-group" data-resource-group={group.tier ?? ''} data-open={shown ? 'true' : 'false'}>
      <button type="button" class="resource-group__toggle" aria-expanded={shown ? 'true' : 'false'} data-action="toggle-group" onClick={() => setShown(!shown)}>
        {group.label}
        <Sep />
        {group.rows.length}
        {group.rows.some(needsALook) && (
          <>
            <Sep />
            NEEDS A LOOK
          </>
        )}
      </button>
      {rows}
    </li>
  );
}

function ResourceSheet({ feed, close, onOpenSettings, onSeen, onVerdict, onFoodJump }: { feed: ResourceFeed; close: () => void } & ResourceSheetOptions) {
  const colonyOn = selectPhase.value !== Phase.EGG_LAYING;
  useEffect(() => feed.retain(), [feed]);
  // What changed since the session's last opening (Story 9.11), fixed when the sheet opens.
  const [since] = useState(() => {
    const now: SheetMoment = { atMs: Date.now(), food: Math.floor(selectResources.peek().food), netPerSec: selectFoodRatePerSec.peek() };
    const before = sheetOpened(now);
    return before ? { before, now } : null;
  });
  const rows = feed.snapshot.value.rows.filter((r) => r.unlocked);
  // NEW: unlocked and not yet seen this run, fixed when the sheet opens; marked seen when it closes.
  const [fresh] = useState<ReadonlySet<string>>(() => {
    const seen = selectSeenResources.peek();
    return new Set(seen === null ? [] : rows.map((r) => r.id).filter((id) => !seen.includes(id)));
  });
  const shownIds = useRef<string[]>([]);
  shownIds.current = rows.map((r) => r.id);
  useEffect(() => () => onSeen?.(shownIds.current), []);
  const [peek, setPeek] = useState<ResourceId | null>(null);
  const layout = sheetLayout(rows);

  const settings = (
    <Button
      verb={
        <>
          [ SETTINGS <GEAR_GLYPH /> ]
        </>
      }
      label="Settings"
      data-action="settings"
      disabled={onOpenSettings ? false : SETTINGS_NOT_READY}
      onPress={() => {
        close();
        onOpenSettings?.();
      }}
    />
  );

  return (
    <ModalSheet headline="RESOURCES" class="resource-sheet" data-resource-sheet="" action={settings}>
      <VerdictLine onVerdict={onVerdict} close={close} />
      {colonyOn && <FoodBlock onFoodJump={onFoodJump} close={close} />}
      {since && <SinceLine before={since.before} now={since.now} />}
      <p class="resource-sheet__header" data-resource-header="">
        {decorate(`AMOUNT · RATE · SOURCE · LAST ${formatDuration(sheetBalance.sparkWindowMs).toUpperCase()} · TAP FOR MORE`)}
      </p>
      <ul class="resource-sheet__list" data-resource-list="">
        {layout.groups.map((g) => (
          <Group key={g.tier ?? 'all'} group={g} fresh={fresh} peek={peek} setPeek={setPeek} />
        ))}
      </ul>
    </ModalSheet>
  );
}

/** Request the resource sheet; returns its sheet id. */
export function openResourceSheet(sheets: SheetController, feed: ResourceFeed, opts: ResourceSheetOptions = {}): number {
  return sheets.open({
    priority: 'modal',
    render: (close) => (
      <ResourceSheet feed={feed} close={close} onOpenSettings={opts.onOpenSettings} onSeen={opts.onSeen} onVerdict={opts.onVerdict} onFoodJump={opts.onFoodJump} />
    ),
  });
}
