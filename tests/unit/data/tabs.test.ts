import { describe, it, expect } from 'vitest';
import { Phase, PHASE_ORDER } from '../../../src/phases/phases';
import { MAX_TABS } from '../../../src/data/constants';
import {
  PANEL_PLACEMENT,
  TABS,
  SEGMENTS,
  panelsForPhase,
  segmentsForPhase,
  tabsForPhase,
  showsTabBar,
  isUnlocked,
  type PanelId,
} from '../../../src/data/content/tabs';
import { PhaseContent } from '../../../src/ui/PhaseContent';

/**
 * Story 1.15 (AR10, arch D7): the tab registry is data. It replaces PHASE_PANELS
 * and places every legacy panel in its destination tab (EXPERIENCE.md, panel consolidation).
 */
describe('tab registry', () => {
  it('no phase shows more than MAX_TABS tabs', () => {
    for (const phase of PHASE_ORDER) {
      expect(tabsForPhase(phase).length).toBeLessThanOrEqual(MAX_TABS);
    }
    expect(TABS.length).toBeLessThanOrEqual(MAX_TABS);
  });

  it('Phase 1 shows no tab bar: NEST is the whole game', () => {
    expect(tabsForPhase(Phase.EGG_LAYING)).toEqual(['nest']);
    expect(showsTabBar(Phase.EGG_LAYING)).toBe(false);
  });

  it('entering Colony reveals NEST · WRKR · BUILD · LOG at once', () => {
    expect(tabsForPhase(Phase.COLONY)).toEqual(['nest', 'wrkr', 'build', 'log']);
    expect(showsTabBar(Phase.COLONY)).toBe(true);
  });

  it('Combat adds FRONT, in bar order', () => {
    expect(tabsForPhase(Phase.COMBAT)).toEqual(['nest', 'wrkr', 'build', 'front', 'log']);
  });

  it('a later phase never removes a tab', () => {
    for (let i = 1; i < PHASE_ORDER.length; i++) {
      const before = tabsForPhase(PHASE_ORDER[i - 1]);
      const after = tabsForPhase(PHASE_ORDER[i]);
      for (const t of before) expect(after).toContain(t);
    }
  });

  it('FRONT segments grow WAR → WAR · MAP → WAR · MAP · STARS', () => {
    expect(segmentsForPhase('front', Phase.COLONY)).toEqual([]);
    expect(segmentsForPhase('front', Phase.COMBAT)).toEqual(['war']);
    expect(segmentsForPhase('front', Phase.EXPANSION)).toEqual(['war', 'map']);
    expect(segmentsForPhase('front', Phase.SPACE)).toEqual(['war', 'map', 'stars']);
    for (const s of SEGMENTS) expect(s.tab).toBe('front');
  });

  it('a panel never unlocks before its tab or segment', () => {
    for (const [id, p] of Object.entries(PANEL_PLACEMENT)) {
      if (p.tab === 'strip') continue;
      expect(tabsForPhase(p.unlockPhase), id).toContain(p.tab);
      if (p.segment) expect(segmentsForPhase(p.tab, p.unlockPhase), id).toContain(p.segment);
    }
  });

  it('FRONT panels each sit in a segment; panels outside FRONT never do', () => {
    for (const [id, p] of Object.entries(PANEL_PLACEMENT)) {
      if (p.tab === 'front') expect(p.segment, id).toBeDefined();
      else expect(p.segment, id).toBeUndefined();
    }
  });

  it('hosts each legacy panel in its destination tab (EXPERIENCE.md consolidation table)', () => {
    const expected: Record<string, [string, string?]> = {
      resource_panel: ['strip'],
      phase_indicator: ['nest'],
      click_button: ['nest'],
      event_log: ['nest'],
      transcendence_panel: ['nest'],
      worker_assignment: ['wrkr'],
      wrkr_primary: ['wrkr'],
      food_display: ['wrkr'],
      automation_panel: ['wrkr'],
      building_panel: ['build'],
      research_panel: ['build'],
      tech_tree_panel: ['build'],
      resource_converter_panel: ['build'],
      soldier_panel: ['front', 'war'],
      battle_panel: ['front', 'war'],
      combat_log: ['front', 'war'],
      mutation_panel: ['front', 'war'],
      map_panel: ['front', 'map'],
      expedition_panel: ['front', 'map'],
      spaceship_panel: ['front', 'stars'],
      starmap_panel: ['front', 'stars'],
      exploration_panel: ['front', 'stars'],
      cosmic_panel: ['front', 'stars'],
      prestige_panel: ['log'],
      prestige_tree_panel: ['log'],
    };
    expect(Object.keys(PANEL_PLACEMENT).sort()).toEqual(Object.keys(expected).sort());
    for (const [id, [tab, segment]] of Object.entries(expected)) {
      const p = PANEL_PLACEMENT[id as PanelId];
      expect(p.tab, id).toBe(tab);
      expect(p.segment, id).toBe(segment);
    }
  });

  it('the NEST primary zone holds the lay-egg button', () => {
    expect(PANEL_PLACEMENT.click_button.zone).toBe('primary');
    const primaries = Object.values(PANEL_PLACEMENT).filter((p) => p.zone === 'primary');
    // At most one primary action per tab.
    const tabs = primaries.map((p) => p.tab);
    expect(new Set(tabs).size).toBe(tabs.length);
  });

  it('panels accumulate: what one phase shows, every later phase shows too', () => {
    for (let i = 1; i < PHASE_ORDER.length; i++) {
      const before = panelsForPhase(PHASE_ORDER[i - 1]);
      const after = panelsForPhase(PHASE_ORDER[i]);
      for (const p of before) expect(after).toContain(p);
    }
    expect(panelsForPhase(Phase.TRANSCENDENCE).sort()).toEqual(Object.keys(PANEL_PLACEMENT).sort());
  });

  it('isUnlocked compares phases in game order', () => {
    expect(isUnlocked(Phase.COLONY, Phase.EGG_LAYING)).toBe(false);
    expect(isUnlocked(Phase.COLONY, Phase.COLONY)).toBe(true);
    expect(isUnlocked(Phase.COLONY, Phase.SPACE)).toBe(true);
  });

  it('PhaseContent reads its active panels from the registry (PHASE_PANELS is gone)', () => {
    const pc = new PhaseContent();
    for (const phase of PHASE_ORDER) {
      expect(pc.getActivePanels(phase).sort()).toEqual(panelsForPhase(phase).sort());
    }
  });
});
