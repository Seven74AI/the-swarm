import { Phase } from '../phases/phases';
import type { UIRoot } from './UIRoot';
import { panelsForPhase } from '../data/content/tabs';

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
    // The tab registry (data/content/tabs.ts, Story 1.15) is the one source of panel unlocks.
    return panelsForPhase(phase);
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
    // Stagger panel reveals — each panel gets an incremental animation-delay
    // so they cascade in one-by-one (150ms per panel) under the phase reveal (Story 1.20).
    const STAGGER_MS = 150;
    for (let i = 0; i < panels.length; i++) {
      const panelId = panels[i];
      // createPanel() ensures the panel exists (lazy creation for Phase 4+).
      // Gracefully skip panels not yet in the registry (e.g. cosmic_panel).
      try {
        uiRoot.createPanel(panelId);
      } catch {
        // Panel not yet implemented — skip creation, continue to reveal existing
      }
      // showPanel() reveals it (sets display, adds unlocked class, emits event)
      // Pass staggered delay so panels cascade rather than appearing at once
      uiRoot.showPanel(panelId, i * STAGGER_MS);
    }
  }
}
