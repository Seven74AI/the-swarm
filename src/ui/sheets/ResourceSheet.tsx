import { useEffect } from 'preact/hooks';
import { formatDeltaFull, formatFull } from '../../utils/format';
import { Button } from '../primitives/Button';
import { ModalSheet } from '../shell/Sheet';
import type { SheetController } from '../shell/SheetController';
import { GEAR_GLYPH, RESOURCE_BY_ID } from '../shell/resourceCatalog';
import type { ResourceFeed } from '../shell/resourceFeed';
import './ResourceSheet.css';
import { decorate } from '../primitives/Deco';

/**
 * The resource sheet (Story 1.16; UX-DR8, DESIGN.md → Resource sheet).
 *
 * Opened by a tap on the resource strip, through the SheetController as an
 * ordinary modal. Every unlocked resource: 30 px glyph, full name, the exact
 * integer (`formatFull`), its rate per second (the unit is stated once, in the
 * header), its cap and its source. `[ SETTINGS ⚙ ]` sits at the bottom, so
 * settings are reachable from Phase 1. main passes `onOpenSettings`, which
 * opens the settings screen (Story 1.27); without it the button is shown
 * disabled with its reason.
 *
 * It reads the same `ResourceFeed` as the strip, so it refreshes at most 4
 * times a second. Hooks: `[data-resource-sheet]`, `[data-resource-header]`,
 * `[data-resource-list]`, `[data-resource-row=<id>]` with `[data-col=name|amount|rate|cap|source]`,
 * `[data-action="settings"]`.
 */

export interface ResourceSheetOptions {
  /** Opens the settings screen; the resource sheet closes first. */
  onOpenSettings?: () => void;
}

const NO_CAP = '—';
export const SETTINGS_NOT_READY = 'Settings are not available yet';

function ResourceSheet({ feed, close, onOpenSettings }: { feed: ResourceFeed; close: () => void } & ResourceSheetOptions) {
  useEffect(() => feed.retain(), [feed]);
  const rows = feed.snapshot.value.rows.filter((r) => r.unlocked);

  const settings = (
    <Button
      verb={`[ SETTINGS ${GEAR_GLYPH} ]`}
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
        {decorate('AMOUNT · RATE /s · CAP · SOURCE')}
      </p>
      <ul class="resource-sheet__list" data-resource-list="">
        {rows.map((row) => {
          const def = RESOURCE_BY_ID[row.id];
          return (
            <li key={row.id} class="resource-row" data-resource-row={row.id} data-capped={String(row.capped)}>
              <span class="resource-row__glyph" data-glyph="" aria-hidden="true">
                {def.glyph}
              </span>
              <span class="resource-row__name" data-col="name">
                {def.name}
              </span>
              <span class="resource-row__amount" data-col="amount">
                {formatFull(row.amount)}
              </span>
              <span class="resource-row__rate" data-col="rate" data-trend={row.rate > 0 ? 'up' : row.rate < 0 ? 'down' : 'flat'}>
                {formatDeltaFull(row.rate)}
              </span>
              <span class="resource-row__cap" data-col="cap">
                {row.cap === null ? NO_CAP : formatFull(row.cap)}
              </span>
              <span class="resource-row__source" data-col="source">
                {def.source}
              </span>
            </li>
          );
        })}
      </ul>
    </ModalSheet>
  );
}

/** Request the resource sheet; returns its sheet id. */
export function openResourceSheet(sheets: SheetController, feed: ResourceFeed, opts: ResourceSheetOptions = {}): number {
  return sheets.open({
    priority: 'modal',
    render: (close) => <ResourceSheet feed={feed} close={close} onOpenSettings={opts.onOpenSettings} />,
  });
}
