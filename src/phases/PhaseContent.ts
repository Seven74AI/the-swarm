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
    'food_display',
  ],
  [Phase.COMBAT]: [
    'click_button',
    'event_log',
    'phase_indicator',
    'resource_panel',
    'worker_assignment',
    'food_display',
    'soldier_panel',
    'battle_panel',
    'combat_log',
  ],
  [Phase.EXPANSION]: [
    'click_button',
    'event_log',
    'phase_indicator',
    'resource_panel',
    'worker_assignment',
    'food_display',
    'soldier_panel',
    'battle_panel',
    'combat_log',
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
    'food_display',
    'soldier_panel',
    'battle_panel',
    'combat_log',
    'map_panel',
    'building_panel',
    'expedition_panel',
    'spaceship_panel',
    'exploration_panel',
    'cosmic_panel',
    'starmap_panel',
    'resource_converter_panel',
    'research_panel',
  ],
  [Phase.TRANSCENDENCE]: [
    'click_button',
    'event_log',
    'phase_indicator',
    'resource_panel',
    'worker_assignment',
    'food_display',
    'soldier_panel',
    'battle_panel',
    'combat_log',
    'map_panel',
    'building_panel',
    'expedition_panel',
    'spaceship_panel',
    'exploration_panel',
    'cosmic_panel',
    'starmap_panel',
    'resource_converter_panel',
    'transcendence_panel',
    'tech_tree_panel',
    'automation_panel',
    'prestige_panel',
    'prestige_tree_panel',
    'research_panel',
  ],
};

export class PhaseContent {
  /**
   * Maps each phase to its CSS body class for theme shifting.
   */
  private static readonly PHASE_CLASS_MAP: Record<string, string> = {
    [Phase.EGG_LAYING]: 'phase-egg',
    [Phase.COLONY]: 'phase-colony',
    [Phase.COMBAT]: 'phase-combat',
    [Phase.EXPANSION]: 'phase-expansion',
    [Phase.SPACE]: 'phase-space',
    [Phase.TRANSCENDENCE]: 'phase-transcendence',
  };

  /**
   * Returns the CSS body class for a given phase.
   */
  static getPhaseBodyClass(phase: Phase): string | undefined {
    return PhaseContent.PHASE_CLASS_MAP[phase];
  }

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
   * On prestige runs (prestigeCount > 0), the transition becomes skippable via
   * click or keypress (Space/Enter/Escape). Skipping immediately calls onPhaseEnter
   * and emits transition_complete.
   *
   * @param phase         The new phase being entered.
   * @param bus           Event bus for emitting transition events.
   * @param uiRoot        Root UI controller for panel management.
   * @param prestigeCount Number of times the player has prestiged (0 = no skips).
   */
  triggerTransition(phase: Phase, bus: EventBus, uiRoot: UIRoot, prestigeCount: number = 0): void {
    const quote = this.getLoreQuote(phase);
    const skippable = prestigeCount > 0;

    // Timeout handles for auto-completion (cleared on skip)
    let revealTimeout: ReturnType<typeof setTimeout> | undefined;
    let completeTimeout: ReturnType<typeof setTimeout> | undefined;

    const onSkip = skippable ? () => {
      // Clear auto-completion timeouts
      if (revealTimeout !== undefined) clearTimeout(revealTimeout);
      if (completeTimeout !== undefined) clearTimeout(completeTimeout);
      // Immediately reveal panels and complete transition
      this.onPhaseEnter(phase, uiRoot);
      bus.emit('transition_complete', { phase });
    } : undefined;

    bus.emit('transition_start', { phase, quote, skippable, onSkip });

    // If skipped, onSkip was already called — don't schedule timeouts.
    // We detect skip by checking whether the timeouts have been cleared.
    if (skippable) {
      // Store timeouts for potential clearing
      revealTimeout = setTimeout(() => {
        this.onPhaseEnter(phase, uiRoot);
      }, 300);

      completeTimeout = setTimeout(() => {
        bus.emit('transition_complete', { phase });
      }, 2000);
    } else {
      // Non-prestige: standard timing
      setTimeout(() => {
        this.onPhaseEnter(phase, uiRoot);
      }, 300);

      setTimeout(() => {
        bus.emit('transition_complete', { phase });
      }, 2000);
    }
  }

  /**
   * Called when entering a new phase. Creates lazy panels on demand, reveals
   * all active panels, and sets the body class for phase theme shifting.
   * For Phase 1 panels that were mounted at boot, createPanel()
   * is idempotent (returns the existing element). For Phase 2+ panels, createPanel()
   * instantiates them lazily — making reveals feel like genuine new features.
   */
  onPhaseEnter(phase: Phase, uiRoot: UIRoot): void {
    // ── Set body class for phase theme shifting ──
    // Remove any existing phase-* class (safe: collect then remove)
    const phaseClasses = Array.from(document.body.classList).filter(
      (cls) => cls.startsWith('phase-'),
    );
    for (const cls of phaseClasses) {
      document.body.classList.remove(cls);
    }
    const bodyClass = PhaseContent.PHASE_CLASS_MAP[phase];
    if (bodyClass) {
      document.body.classList.add(bodyClass);
    }

    const panels = this.getActivePanels(phase);
    for (const panelId of panels) {
      // createPanel() ensures the panel exists (lazy creation for Phase 4+).
      // Gracefully skip panels not yet in the registry (e.g. cosmic_panel).
      try {
        uiRoot.createPanel(panelId);
      } catch {
        // Panel not yet implemented — skip creation, continue to reveal existing
      }
      // showPanel() reveals it (sets display, adds unlocked class, emits event)
      uiRoot.showPanel(panelId);
    }
  }
}
