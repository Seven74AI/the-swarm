import type { EventBus } from '../../engine/EventBus';
import type { DecisionEvent } from '../../systems/DecisionSystem';

const AUTO_DISMISS_MS = 30_000;

/**
 * Non-blocking decision popup rendered bottom-right.
 * Shows event title, description, and 2-4 choice buttons.
 * Auto-dismisses after 30s if ignored. Emits 'decision_chosen' on choice.
 */
export class DecisionPopup {
  private el: HTMLElement;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private bus: EventBus) {
    this.el = document.createElement('div');
    this.el.id = 'decision-popup';
    this.setupStyles();
  }

  /**
   * Show a decision event. Replaces any currently shown event.
   */
  show(event: DecisionEvent): void {
    this.clearTimer();

    this.el.innerHTML = `
      <div class="decision-popup-inner">
        <div class="decision-popup-title">${event.title}</div>
        <div class="decision-popup-desc">${event.description}</div>
        <div class="decision-popup-choices">
          ${event.choices
            .map(
              (c) =>
                `<button class="decision-choice-btn" data-choice="${c.label}">
                  <span class="decision-choice-label">${c.label}</span>
                  <span class="decision-choice-desc">${c.description}</span>
                </button>`,
            )
            .join('')}
        </div>
      </div>
    `;

    // Wire button clicks
    this.el.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const choice = btn.getAttribute('data-choice');
        if (choice) {
          this.bus.emit('decision_chosen', {
            type: event.type,
            choice,
          });
          this.hide();
        }
      });
    });

    this.el.style.display = '';

    // Auto-dismiss after 30s
    this.dismissTimer = setTimeout(() => {
      this.hide();
    }, AUTO_DISMISS_MS);
  }

  /**
   * Hide the popup and clear the auto-dismiss timer.
   */
  hide(): void {
    this.clearTimer();
    this.el.style.display = 'none';
  }

  getElement(): HTMLElement {
    return this.el;
  }

  private clearTimer(): void {
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  }

  private setupStyles(): void {
    this.el.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      max-width: 320px;
      display: none;
    `;
  }
}
