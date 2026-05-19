import { Phase } from './phases';
import type { UIRoot } from '../ui/UIRoot';

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
};

export class PhaseContent {
  /**
   * Returns the list of panel IDs active for a given phase.
   */
  getActivePanels(phase: Phase): string[] {
    return PHASE_PANELS[phase] ?? PHASE_PANELS[Phase.EGG_LAYING];
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
