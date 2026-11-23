import { useEffect, useRef, useState } from 'preact/hooks';
import { formatFull, formatSheetRate } from '../../utils/format';
import { Button } from '../primitives/Button';
import { ModalSheet } from '../shell/Sheet';
import type { SheetController } from '../shell/SheetController';
import { GEAR_GLYPH, RESOURCE_BY_ID, type ResourceId } from '../shell/resourceCatalog';
import type { ResourceFeed, ResourceRow } from '../shell/resourceFeed';
import { selectResourceFlows, selectSeenResources } from '../../state/selectors';
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
}

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

function ResourceSheet({ feed, close, onOpenSettings, onSeen }: { feed: ResourceFeed; close: () => void } & ResourceSheetOptions) {
  useEffect(() => feed.retain(), [feed]);
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
      <p class="resource-sheet__header" data-resource-header="">
        {decorate('AMOUNT · RATE · SOURCE · LAST 10 MIN · TAP FOR MORE')}
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
    render: (close) => <ResourceSheet feed={feed} close={close} onOpenSettings={opts.onOpenSettings} onSeen={opts.onSeen} />,
  });
}
