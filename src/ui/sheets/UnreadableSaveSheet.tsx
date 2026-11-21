import type { ReadonlySignal } from '@preact/signals';
import type { SheetController } from '../shell/SheetController';
import { ModalSheet } from '../shell/Sheet';
import { Button } from '../primitives/Button';
import { HoldToConfirm, type ConfirmSettings } from '../primitives/HoldToConfirm';

/**
 * The unreadable-save sheet (Story 2.2; UX-DR33, NFR8).
 *
 * Opened by main when the save on this device couldn't be read (bad JSON, a
 * version newer than this build, a migration that throws). Until the player
 * chooses, nothing is written (SaveManager holds every save) and the damaged
 * text stays aside under its own key, so EXPORT DIAGNOSTICS can hand it over
 * later. LOAD BACKUP makes the newest readable backup the save (disabled when
 * there is none); START OVER is irreversible, so it is a hold-to-confirm. The
 * sheet can't be dismissed and its scrim blocks taps; it opens at `offline`
 * priority, ahead of every other sheet.
 * Hooks: `[data-unreadable-save]`, `[data-action="load-backup"|"start-over"]`.
 */

export const UNREADABLE_HEADLINE = "THIS SAVE COULDN'T BE READ.";

export interface UnreadableSaveHandlers {
  /** A backup decodes: LOAD BACKUP can be used. */
  hasBackup: boolean;
  onLoadBackup: () => void;
  onStartOver: () => void;
  /** Confirm style and hold duration (platform settings, passed in from main). */
  confirmSettings: ReadonlySignal<ConfirmSettings>;
}

export function UnreadableSaveSheet({ hasBackup, onLoadBackup, onStartOver, confirmSettings }: UnreadableSaveHandlers) {
  return (
    <ModalSheet
      headline={UNREADABLE_HEADLINE}
      dismissible={false}
      passthrough={false}
      data-unreadable-save=""
      actions={[
        <Button
          key="backup"
          variant="primary"
          verb="LOAD BACKUP"
          onPress={onLoadBackup}
          disabled={hasBackup ? false : 'NO BACKUP CAN BE READ'}
          data-action="load-backup"
        />,
        <HoldToConfirm key="over" verb="START OVER" onConfirm={onStartOver} settings={confirmSettings} data-action="start-over" />,
      ]}
    >
      <p>THE DAMAGED SAVE IS KEPT ASIDE. NOTHING IS WRITTEN UNTIL YOU CHOOSE.</p>
      <p>{hasBackup ? 'LOAD BACKUP GOES BACK TO THE LAST SAVE THAT READS.' : 'NO BACKUP CAN BE READ. START OVER BEGINS A NEW GAME.'}</p>
    </ModalSheet>
  );
}

/** Request the unreadable-save sheet; returns its sheet id. */
export function openUnreadableSave(sheets: SheetController, handlers: UnreadableSaveHandlers): number {
  return sheets.open({ priority: 'offline', dismissible: false, render: () => <UnreadableSaveSheet {...handlers} /> });
}
