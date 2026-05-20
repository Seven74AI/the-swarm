import { Phase } from './phases';
import type { UIRoot } from '../ui/UIRoot';
import type { EventBus } from '../engine/EventBus';

/** Lore quotes — one displayed during each phase transition. */
const LORE_QUOTES: Record<string, string[]> = {
  [Phase.EGG_LAYING]: [
    'A single queen, alone in the dark earth. The first egg is an act of faith.',
  ],
  [Phase.COLONY]: [
    'Many legs, one mind. The colony breathes as a single organism.',
  ],
  [Phase.COMBAT]: [
    'The workers look at the stars. The stars look back.',
  ],
  [Phase.EXPANSION]: [
    'Beyond the nest, beyond the garden — the world awaits discovery.',
  ],
  [Phase.SPACE]: [
    'Gravity is a chain. The swarm breaks free.',
  ],
  [Phase.TRANSCENDENCE]: [
    'The swarm collapses into a singularity of pure thought. All boundaries dissolve.',
  ],
};

/**
 * Maps each phase to which UI panels should be active.
 * As the game progresses, new panels are revealed.
 */
const PHASE_PANELS: Record<string, string[]> = {
  [Phase.EGG_LAYING]: [
    'click_button',
    'event_log',
    'phase_indicator',
    'resource_panel',
  ],
  [Phase.COLONY]: [
    'click_button',
    'event_log',
    'phase_indicator',
    'resource_panel',
    'worker_assignment',
  ],
  [Phase.COMBAT]: [
    'click_button',
    'event_log',
    'phase_indicator',
    'resource_panel',
    'worker_assignment',
    'soldier_panel',
    'battle_panel',
  ],
  [Phase.EXPANSION]: [
    'click_button',
    'event_log',
    'phase_indicator',
    'resource_panel',
    'worker_assignment',
    'soldier_panel',
    'battle_panel',
    'map_panel',
    'building_panel',
    'expedition_panel',
  ],
  [Phase.SPACE]: [
    'click_button',
    'event_log',
    'phase_indicator',
    'resource_panel',
    'worker_assignment',
    'soldier_panel',
    'battle_panel',
    'map_panel',
    'building_panel',
    'expedition_panel',
    'spaceship_panel',
    'exploration_panel',
  ],
  [Phase.TRANSCENDENCE]: [
    'click_button',
    'event_log',
    'phase_indicator',
    'resource_panel',
    'worker_assignment',
    'soldier_panel',
    'battle_panel',
    'map_panel',
    'building_panel',
    'expedition_panel',
    'spaceship_panel',
    'exploration_panel',
  ],
};

export class PhaseContent {
  /**
   * Returns the list of panel IDs active for a given phase.
   */
  getActivePanels(phase: Phase): string[] {
    return PHASE_PANELS[phase] ?? PHASE_PANELS[Phase.EGG_LAYING];
  }

  /**
   * Returns a random lore quote for the given phase.
   * Falls back to a generic message for unknown phases.
   */
  getLoreQuote(phase: string): string {
    const quotes = LORE_QUOTES[phase];
    if (quotes && quotes.length > 0) {
      return quotes[Math.floor(Math.random() * quotes.length)];
    }
    return 'The swarm marches on.';
  }

  /**
   * Triggers the visual phase transition sequence.
   * Emits transition_start immediately and transition_complete after the animation duration.
   *
   * @param phase   The new phase being entered.
   * @param bus     Event bus for emitting transition events.
   * @param uiRoot  Root UI controller for panel management.
   */
  triggerTransition(phase: Phase, bus: EventBus, uiRoot: UIRoot): void {
    const quote = this.getLoreQuote(phase);
    bus.emit('transition_start', { phase, quote });

    // Reveal new panels after the overlay is visible (0.3s delay)
    setTimeout(() => {
      this.onPhaseEnter(phase, uiRoot);
    }, 300);

    // End transition after full animation (2s total)
    setTimeout(() => {
      bus.emit('transition_complete', { phase });
    }, 2000);
  }

  /**
   * Called when entering a new phase. Reveals/unlocks new panels in the UI.
   */
  onPhaseEnter(phase: Phase, uiRoot: UIRoot): void {
    const panels = this.getActivePanels(phase);
    for (const panelId of panels) {
      uiRoot.showPanel(panelId);
    }
  }
}
