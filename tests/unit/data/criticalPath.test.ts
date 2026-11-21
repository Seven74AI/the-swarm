import { describe, it, expect } from 'vitest';
import { CRITICAL_PATH } from '../../../src/data/content/criticalPath';
import { itemKey, itemPanel, listItems } from '../../../src/systems/NextAction';
import { PHASE_ORDER } from '../../../src/phases/phases';
import { PANEL_PLACEMENT, isUnlocked } from '../../../src/data/content/tabs';

/** Story 1.21: one critical-path table per phase, data only (UX-DR12, arch D7). */
describe('critical-path tables (Story 1.21)', () => {
  it('has a table for every phase', () => {
    for (const phase of PHASE_ORDER) expect(Array.isArray(CRITICAL_PATH[phase])).toBe(true);
  });

  it('lists only items the next-action rule knows, each once per table', () => {
    const known = new Set(listItems().map(itemKey));
    for (const phase of PHASE_ORDER) {
      const keys = CRITICAL_PATH[phase].map(itemKey);
      for (const k of keys) expect(known).toContain(k);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("lists only items whose panel is open in that phase", () => {
    for (const phase of PHASE_ORDER) {
      for (const ref of CRITICAL_PATH[phase]) {
        expect(isUnlocked(PANEL_PLACEMENT[itemPanel(ref)].unlockPhase, phase)).toBe(true);
      }
    }
  });
});
