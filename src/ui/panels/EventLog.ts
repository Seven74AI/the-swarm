import type { EventBus } from '../../engine/EventBus';

interface LogEntry {
  message: string;
  timestamp: number;
}

const MAX_ENTRIES = 100;

/**
 * Scrolling activity log. Listens for game events and shows narrative messages.
 * Newest entry at top, max 100 entries.
 */
export class EventLog {
  private container: HTMLDivElement;
  private entries: LogEntry[] = [];
  private logEl: HTMLDivElement;
  private firstClickFired = false;
  private firstWorkerFired = false;
  private tenthWorkerFired = false;

  constructor(private bus: EventBus) {
    this.container = document.createElement('div');
    this.container.className = 'panel event-log';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Activity Log';
    this.container.appendChild(title);

    this.logEl = document.createElement('div');
    this.logEl.className = 'event-log-entries';
    this.container.appendChild(this.logEl);

    // Initial message
    this.addEntry('You are an ant queen. Your purpose is clear.');

    // Listen for events
    bus.subscribe('click:egg', () => this.onClick());
    bus.subscribe('workers_changed', () => this.onWorkersChanged());
  }

  private addEntry(message: string): void {
    this.entries.unshift({ message, timestamp: Date.now() });
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.pop();
    }
    this.render();
  }

  private render(): void {
    // Clear and rebuild with textContent (avoids latent XSS vector)
    this.logEl.textContent = '';
    for (const entry of this.entries) {
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.textContent = entry.message;
      this.logEl.appendChild(div);
    }
  }

  private onClick(): void {
    if (!this.firstClickFired) {
      this.firstClickFired = true;
      this.addEntry(
        'You lay your first egg. It is small, white, and perfect.',
      );
    }
  }

  private onWorkersChanged(): void {
    // We'll track worker milestones via the first/first + 10th checks
    // by reading state via the bus — but we don't have direct state access here.
    // Instead, track via the event payload if available.
    // For now, trigger on first worker event.
    if (!this.firstWorkerFired) {
      this.firstWorkerFired = true;
      this.addEntry(
        'The first worker emerges. She looks at you with absolute devotion.',
      );
    }
  }

  /**
   * Called externally when worker count changes, so we can check milestones.
   */
  notifyWorkerCount(count: number): void {
    if (!this.tenthWorkerFired && count >= 10) {
      this.tenthWorkerFired = true;
      this.addEntry(
        'The colony hums. You feel it through the soil.',
      );
    }
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
