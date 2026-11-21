import type { SheetController } from '../shell/SheetController';
import { ModalSheet } from '../shell/Sheet';
import { Button } from '../primitives/Button';

/**
 * The tick-failure sheet (Story 1.17, AR16).
 *
 * Opened by main once 3 ticks in a row have failed and the simulation has
 * stopped. It offers the two ways out: EXPORT SAVE (a file of the last good
 * snapshot) and RELOAD. It can't be dismissed and its scrim blocks taps, since
 * the colony behind it no longer runs. It opens at `offline` priority, the
 * highest, so it goes ahead of any decision or battle sheet.
 * Hooks: `[data-tick-failure]`, `[data-action="export-save"]`, `[data-action="reload"]`.
 */

export interface TickFailureHandlers {
  onExport: () => void;
  onReload: () => void;
}

export function TickFailureSheet({ onExport, onReload }: TickFailureHandlers) {
  return (
    <ModalSheet
      headline="THE COLONY STOPPED."
      dismissible={false}
      passthrough={false}
      data-tick-failure=""
      actions={[
        <Button key="export" variant="primary" verb="EXPORT SAVE" onPress={onExport} data-action="export-save" />,
        <Button key="reload" verb="RELOAD" onPress={onReload} data-action="reload" />,
      ]}
    >
      <p>SOMETHING BROKE IN THE SIMULATION. YOUR LAST GOOD SAVE IS KEPT.</p>
    </ModalSheet>
  );
}

/** Request the tick-failure sheet; returns its sheet id. */
export function openTickFailure(sheets: SheetController, handlers: TickFailureHandlers): number {
  return sheets.open({ priority: 'offline', dismissible: false, render: () => <TickFailureSheet {...handlers} /> });
}
