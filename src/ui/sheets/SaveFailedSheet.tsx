import type { SheetController } from '../shell/SheetController';
import { ModalSheet } from '../shell/Sheet';
import { Button } from '../primitives/Button';

/**
 * The save-failed sheet (Story 2.2; UX-DR33), opened from the `• SAVE FAILED`
 * marker. It says what happened and offers EXPORT SAVE (a file of the game as
 * it is now). Dismissible: the game keeps running.
 * Hooks: `[data-save-failed-sheet]`, `[data-action="export-save"]`.
 */
export interface SaveFailedHandlers {
  onExport: () => void;
}

export function SaveFailedSheet({ onExport }: SaveFailedHandlers) {
  return (
    <ModalSheet
      headline="THE GAME COULDN'T BE SAVED."
      data-save-failed-sheet=""
      action={<Button variant="primary" verb="EXPORT SAVE" onPress={onExport} data-action="export-save" />}
    >
      <p>STORAGE IS FULL OR BLOCKED. THE GAME KEEPS RUNNING, AND THE LAST GOOD SAVE IS KEPT.</p>
      <p>EXPORT SAVE KEEPS A COPY OF THIS GAME AS A FILE. THE MARKER CLEARS AFTER THE NEXT SAVE THAT WORKS.</p>
    </ModalSheet>
  );
}

/** Request the save-failed sheet; returns its sheet id. */
export function openSaveFailed(sheets: SheetController, handlers: SaveFailedHandlers): number {
  return sheets.open({ priority: 'modal', render: () => <SaveFailedSheet {...handlers} /> });
}
