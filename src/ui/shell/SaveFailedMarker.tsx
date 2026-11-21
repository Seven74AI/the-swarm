import type { ReadonlySignal } from '@preact/signals';
import type { SheetController } from './SheetController';
import { openSaveFailed } from '../sheets/SaveFailedSheet';
import './SaveFailedMarker.css';

/**
 * `• SAVE FAILED` (Story 2.2; UX-DR33): drawn under the resource strip for as
 * long as saving fails, and gone after the next successful write. Tapping it
 * opens the save-failed sheet, which explains and offers EXPORT SAVE. The game
 * keeps running underneath; the last good save is untouched.
 * Hooks: `[data-save-failed]` (`data-action="save-failed"`).
 */
export interface SaveFailedMarkerProps {
  /** True while the last write failed (SaveManager.onSaveStatus, via main). */
  failing: ReadonlySignal<boolean>;
  sheets: SheetController;
  onExport: () => void;
}

export function SaveFailedMarker({ failing, sheets, onExport }: SaveFailedMarkerProps) {
  if (!failing.value) return null;
  return (
    <button
      type="button"
      class="save-failed-marker"
      data-save-failed=""
      data-action="save-failed"
      onClick={() => openSaveFailed(sheets, { onExport })}
    >
      <span aria-hidden="true">•</span> SAVE FAILED
    </button>
  );
}
