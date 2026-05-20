import type { OfflineLoadInfo } from '../../persistence/SaveManager';

/**
 * OfflineSummaryPopup — modal shown after offline progress catch-up.
 *
 * Displays:
 * - How long the player was away (human-readable)
 * - The efficiency used for catch-up
 * - A dismiss button to return to the game
 *
 * DOM structure:
 *   <div class="offline-overlay">
 *     <div class="offline-summary-popup">
 *       <h2>Welcome Back!</h2>
 *       <p class="offline-duration">You were gone for 3h 14m.</p>
 *       <p class="offline-efficiency">Catch-up efficiency: 50%</p>
 *       <button>Return to the colony</button>
 *     </div>
 *   </div>
 */
export class OfflineSummaryPopup {
  private element: HTMLElement;
  private overlayElement: HTMLElement | null = null;
  private onDismiss: () => void;

  constructor(
    private offlineInfo: OfflineLoadInfo,
    onDismiss: () => void,
  ) {
    this.onDismiss = onDismiss;
    this.element = this.buildElement();
  }

  private buildElement(): HTMLElement {
    const popup = document.createElement('div');
    popup.className = 'offline-summary-popup';

    const heading = document.createElement('h2');
    heading.textContent = 'Welcome Back!';
    popup.appendChild(heading);

    const duration = document.createElement('p');
    duration.className = 'offline-duration';
    duration.textContent = `You were gone for ${this.formatDuration(this.offlineInfo.elapsedMs)}.`;
    popup.appendChild(duration);

    const efficiency = document.createElement('p');
    efficiency.className = 'offline-efficiency';
    efficiency.textContent = `Catch-up efficiency: ${Math.round(this.offlineInfo.efficiency * 100)}%`;
    popup.appendChild(efficiency);

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'offline-dismiss-btn btn';
    dismissBtn.textContent = 'Return to the colony';
    dismissBtn.addEventListener('click', () => this.dismiss());
    popup.appendChild(dismissBtn);

    return popup;
  }

  /**
   * Format milliseconds into a human-readable duration string.
   * Examples: "45s", "12m 30s", "3h 14m", "8h"
   */
  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    if (minutes > 0) {
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
    return `${seconds}s`;
  }

  /** Mount popup into a parent element (creates overlay + popup). */
  mount(parent: HTMLElement): void {
    // Create overlay
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'offline-overlay';
    this.overlayElement.appendChild(this.element);
    parent.appendChild(this.overlayElement);
  }

  /** Dismiss the popup (calls onDismiss and removes from DOM). */
  dismiss(): void {
    this.removeFromDOM();
    this.onDismiss();
  }

  /** Full cleanup: remove from DOM, including overlay. */
  cleanup(): void {
    this.removeFromDOM();
  }

  private removeFromDOM(): void {
    if (this.element.parentNode) {
      this.element.remove();
    }
    if (this.overlayElement && this.overlayElement.parentNode) {
      this.overlayElement.remove();
    }
    this.overlayElement = null;
  }

  /** Get the root popup element (for testing). */
  getElement(): HTMLElement {
    return this.element;
  }
}
