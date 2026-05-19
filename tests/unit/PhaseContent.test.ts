import { describe, it, expect, beforeEach } from 'vitest';
import { PhaseContent } from '../../src/phases/PhaseContent';
import { Phase } from '../../src/phases/phases';

describe('PhaseContent', () => {
  let phaseContent: PhaseContent;

  beforeEach(() => {
    phaseContent = new PhaseContent();
  });

  describe('getActivePanels', () => {
    it('returns egg_laying panels', () => {
      const panels = phaseContent.getActivePanels(Phase.EGG_LAYING);
      expect(panels).toContain('click_button');
      expect(panels).toContain('event_log');
      expect(panels).toContain('phase_indicator');
      expect(panels).toContain('resource_panel');
    });

    it('returns colony panels (includes worker_assignment and food)', () => {
      const panels = phaseContent.getActivePanels(Phase.COLONY);
      expect(panels).toContain('click_button');
      expect(panels).toContain('event_log');
      expect(panels).toContain('phase_indicator');
      expect(panels).toContain('resource_panel');
      expect(panels).toContain('worker_assignment');
      expect(panels).toContain('food_display');
    });

    it('colon phase has more panels than egg_laying', () => {
      const eggPanels = phaseContent.getActivePanels(Phase.EGG_LAYING);
      const colonyPanels = phaseContent.getActivePanels(Phase.COLONY);
      expect(colonyPanels.length).toBeGreaterThan(eggPanels.length);
    });

    it('returns expansion panels with map_panel, building_panel, expedition_panel', () => {
      const panels = phaseContent.getActivePanels(Phase.EXPANSION);
      expect(panels).toContain('click_button');
      expect(panels).toContain('event_log');
      expect(panels).toContain('phase_indicator');
      expect(panels).toContain('resource_panel');
      expect(panels).toContain('worker_assignment');
      expect(panels).toContain('food_display');
      expect(panels).toContain('soldier_panel');
      expect(panels).toContain('battle_panel');
      expect(panels).toContain('combat_log');
      expect(panels).toContain('map_panel');
      expect(panels).toContain('building_panel');
      expect(panels).toContain('expedition_panel');
    });

    it('expansion phase has more panels than combat', () => {
      const combatPanels = phaseContent.getActivePanels(Phase.COMBAT);
      const expansionPanels = phaseContent.getActivePanels(Phase.EXPANSION);
      expect(expansionPanels.length).toBeGreaterThan(combatPanels.length);
    });
  });
});
