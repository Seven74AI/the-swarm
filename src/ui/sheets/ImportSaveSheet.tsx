import type { ReadonlySignal } from '@preact/signals';
import type { SheetController } from '../shell/SheetController';
import { ModalSheet } from '../shell/Sheet';
import { HoldToConfirm, type ConfirmSettings } from '../primitives/HoldToConfirm';
import { formatTime } from '../../utils/format';

/**
 * The import sheets (Story 2.11; UX-DR33).
 *
 * IMPORT SAVE (settings) reads a file; main asks SaveManager what it is and
 * opens one of these:
 * - refused: `THAT FILE ISN'T A SWARM SAVE.` The run is unchanged. A file from a
 *   newer build says which save version it is and which this build reads.
 * - confirm: states that the file replaces the current run; REPLACE RUN is a
 *   HoldToConfirm (irreversible here: the replaced run only survives in the
 *   rotating backup). Closing it changes nothing.
 * Hooks: `[data-import-refused=not_a_save|newer_version]`, `[data-import-confirm]`,
 * `[data-action="confirm-import"]`.
 */

export const NOT_A_SAVE_HEADLINE = "THAT FILE ISN'T A SWARM SAVE.";
export const IMPORT_CONFIRM_HEADLINE = 'IMPORT THIS SAVE.';

export interface ImportRefusedInfo {
  readonly reason: 'not_a_save' | 'newer_version';
  /** The file's save version (newer_version). */
  readonly version?: number;
  /** The newest save version this build reads (newer_version). */
  readonly current?: number;
}

export function ImportRefusedSheet({ reason, version, current }: ImportRefusedInfo) {
  return (
    <ModalSheet headline={NOT_A_SAVE_HEADLINE} data-import-refused={reason}>
      {reason === 'newer_version' && (
        <p>
          IT COMES FROM A NEWER BUILD: SAVE VERSION {version}. THIS BUILD READS UP TO VERSION {current}.
        </p>
      )}
      <p>THE CURRENT RUN IS UNCHANGED.</p>
    </ModalSheet>
  );
}

export interface ImportConfirmInfo {
  /** Play time of the run in the file. */
  readonly playTimeMs: number;
  /** Confirm style and hold duration (platform settings, passed in from main). */
  readonly confirmSettings: ReadonlySignal<ConfirmSettings>;
  readonly onConfirm: () => void;
}

export function ImportConfirmSheet({ playTimeMs, confirmSettings, onConfirm }: ImportConfirmInfo) {
  return (
    <ModalSheet
      headline={IMPORT_CONFIRM_HEADLINE}
      data-import-confirm=""
      closeLabel="KEEP THIS RUN"
      action={<HoldToConfirm verb="REPLACE RUN" onConfirm={onConfirm} settings={confirmSettings} data-action="confirm-import" />}
    >
      <p>THE FILE HOLDS A RUN WITH {formatTime(playTimeMs).toUpperCase()} OF PLAY.</p>
      <p>IT REPLACES THE CURRENT RUN. SETTINGS STAY AS THEY ARE.</p>
    </ModalSheet>
  );
}

/** Request the refused-import sheet; returns its sheet id. */
export function openImportRefused(sheets: SheetController, info: ImportRefusedInfo): number {
  return sheets.open({ priority: 'modal', render: () => <ImportRefusedSheet {...info} /> });
}

/** Request the import confirm sheet; returns its sheet id. */
export function openImportConfirm(sheets: SheetController, info: ImportConfirmInfo): number {
  return sheets.open({ priority: 'modal', render: () => <ImportConfirmSheet {...info} /> });
}
