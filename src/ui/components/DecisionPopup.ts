import type { EventBus } from '../../engine/EventBus';
import type { DecisionEvent } from '../../systems/DecisionSystem';

const AUTO_DISMISS_MS = 30_000;

/**
 * Non-blocking decision popup rendered bottom-right.
 * Shows event title, description, and 2-4 choice buttons.
 * Auto-dismisses after 30s if ignored. On choice it calls `choose` (the action
 * that applies the consequence) and then emits 'decision_chosen' as a notification.
 */
export type ChooseDecision = (type: DecisionEvent['type'], choice: string) => void;

export class DecisionPopup {
  private el: HTMLElement;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private bus: EventBus,
    private choose: ChooseDecision = () => {},
  ) {
    this.el = document.createElement('div');
    this.el.id = 'decision-popup';
    this.setupStyles();
  }

  /**
   * Show a decision event. Replaces any currently shown event.
   */
  show(event: DecisionEvent): void {
    this.clearTimer();

    // Built with createElement/textContent so event text is never parsed as HTML.
    const inner = document.createElement('div');
    inner.className = 'decision-popup-inner';

    const title = document.createElement('div');
    title.className = 'decision-popup-title';
    title.textContent = event.title;

    const desc = document.createElement('div');
    desc.className = 'decision-popup-desc';
    desc.textContent = event.description;

    const choices = document.createElement('div');
    choices.className = 'decision-popup-choices';

    for (const c of event.choices) {
      const btn = document.createElement('button');
      btn.className = 'decision-choice-btn';
      btn.dataset.choice = c.label;

      const label = document.createElement('span');
      label.className = 'decision-choice-label';
      label.textContent = c.label;

      const choiceDesc = document.createElement('span');
      choiceDesc.className = 'decision-choice-desc';
      choiceDesc.textContent = c.description;

      btn.append(label, choiceDesc);
      btn.addEventListener('click', () => {
        this.choose(event.type, c.label);
        this.bus.emit('decision_chosen', { type: event.type, choice: c.label });
        this.hide();
      });
      choices.appendChild(btn);
    }

    inner.append(title, desc, choices);
    this.el.replaceChildren(inner);

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
