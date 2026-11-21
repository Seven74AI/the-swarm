import type { OfflineLoadInfo } from '../../engine/resume';
import type { SheetController } from '../shell/SheetController';
import { ModalSheet } from '../shell/Sheet';

/**
 * The offline-summary sheet (Story 1.14; was `OfflineSummaryPopup`, GM-8).
 *
 * Shown after offline catch-up through the SheetController at `offline`
 * priority, so it opens ahead of anything else requested at boot. Same content as
 * the legacy popup: time away, catch-up efficiency, and one button back to the
 * nest (copy in the colony voice, UX-DR42: it can show in any phase). The `.offline-summary-popup` (panel) and `.offline-overlay` (scrim)
 * classes stay as E2E hooks. Story 2.x replaces the body with the summary of
 * gains and the one next action.
 */

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

export function OfflineSummarySheet({ info }: { info: OfflineLoadInfo }) {
  return (
    <ModalSheet
      headline="THE NEST KEPT WORKING."
      class="offline-summary-popup"
      scrimClass="offline-overlay"
      closeLabel="BACK TO THE NEST"
    >
      <p class="offline-duration">YOU WERE GONE {formatAway(info.elapsedMs).toUpperCase()}.</p>
      <p class="offline-efficiency">CATCH-UP EFFICIENCY: {Math.round(info.efficiency * 100)}%</p>
    </ModalSheet>
  );
}

/** Request the offline-summary sheet; returns its sheet id. */
export function openOfflineSummary(sheets: SheetController, info: OfflineLoadInfo, onDismiss?: () => void): number {
  return sheets.open({ priority: 'offline', render: () => <OfflineSummarySheet info={info} />, onClose: onDismiss });
}
