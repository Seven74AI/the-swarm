import type { EventBus } from '../../engine/EventBus';
import { Phase } from '../../phases/phases';

const PHASE_DISPLAY: Record<string, { emoji: string; title: string; className: string }> = {
  [Phase.EGG_LAYING]: {
    emoji: '🐜',
    title: 'The Lonely Queen',
    className: '',
  },
  [Phase.COLONY]: {
    emoji: '🏚️',
    title: 'The Colony',
    className: 'phase-colony',
  },
  [Phase.COMBAT]: {
    emoji: '⚔️',
    title: 'The War',
    className: 'phase-combat',
  },
};

/**
 * Displays the current game phase with themed styling.
 * Subscribes to 'phase_changed' events and transitions smoothly.
 */
export class PhaseIndicator {
  private container: HTMLDivElement;
  private textEl: HTMLSpanElement;

  constructor(private bus: EventBus) {
    this.container = document.createElement('div');
    this.container.id = 'phase-indicator';
    this.container.className = 'phase-indicator';

    this.textEl = document.createElement('span');
    this.textEl.className = 'phase-text';
    this.container.appendChild(this.textEl);

    // Initial display
    this.setPhase(Phase.EGG_LAYING);

    // Listen for phase changes
    bus.subscribe('phase_changed', (payload: unknown) => {
      const phase = (payload as { phase: string }).phase;
      this.setPhase(phase);
    });
  }

  private setPhase(phase: string): void {
    const display = PHASE_DISPLAY[phase] ?? PHASE_DISPLAY[Phase.EGG_LAYING];
    this.textEl.textContent = `${display.emoji} ${display.title}`;
    // Update class: remove all phase- classes, then add current
    this.container.className = `phase-indicator ${display.className}`.trim();
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
