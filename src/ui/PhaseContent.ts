import { Phase } from '../phases/phases';
import type { PanelReveal } from './shell/panelReveal';
import { panelsForPhase, type PanelId } from '../data/content/tabs';

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
  getActivePanels(phase: Phase): PanelId[] {
    // The tab registry (data/content/tabs.ts, Story 1.15) is the one source of panel unlocks.
    return panelsForPhase(phase);
  }

  /**
   * Called when entering a phase (at boot and on every commit): sets the body
   * class for phase theme shifting and reveals the phase's panels (Story 1.36:
   * a panel is absent until then, and stays for the session). Each one is
   * announced as `panel_revealed`, in registry order, and the new ones on
   * screen cascade in (under the phase reveal on a commit, Story 1.20).
   */
  onPhaseEnter(phase: Phase, panels: PanelReveal): void {
    // Remove any existing phase-* class (safe: collect then remove)
    const phaseClasses = Array.from(document.body.classList).filter((cls) => cls.startsWith('phase-'));
    for (const cls of phaseClasses) document.body.classList.remove(cls);
    const bodyClass = PhaseContent.PHASE_CLASS_MAP[phase];
    if (bodyClass) document.body.classList.add(bodyClass);
    panels.reveal(this.getActivePanels(phase));
  }
}
