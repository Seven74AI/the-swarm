// @ts-nocheck — fast-check type inference weak with noImplicitAny
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createInitialState, type GameState } from '../../src/state/GameState';
import {
  AUTOMATION_BUILDINGS,
  RESEARCHES,
  autoBuildingLockedBy,
  buildAuto,
  canBuildAuto,
  canResearch,
  getAutoEggRate,
  research,
  researchUnlocking,
  type AutomationBuildingType,
  type ResearchType,
} from '../../src/systems/AutomationSystem';

/**
 * #193 (owner decision 2026-11-23): Thermal Regulation unlocks the nursery and
 * Cloning Vats unlocks the hatchery (`unlocksBuilding`). Neither building can be
 * built until its research is complete. A save that already owns one keeps it.
 */

const BUILDINGS = Object.keys(AUTOMATION_BUILDINGS) as AutomationBuildingType[];
const RESEARCH_IDS = Object.keys(RESEARCHES) as ResearchType[];
const GATED = BUILDINGS.filter((b) => researchUnlocking(b) !== undefined);

/** A state rich enough to afford any research or building, with the given researches done. */
function rich(researches: Partial<Record<ResearchType, boolean>> = {}, buildings = {}): GameState {
  const s = createInitialState();
  const lots = 1_000_000_000;
  return {
    ...s,
    resources: {
      ...s.resources,
      food: lots,
      workers: lots,
      wood: lots,
      stone: lots,
      nectar: lots,
      voidCrystals: lots,
      antimatter: lots,
    },
    autoProduction: {
      ...s.autoProduction,
      researches: { ...s.autoProduction.researches, ...researches },
      buildings: { ...s.autoProduction.buildings, ...buildings },
    },
  };
}

/** Every research, done. */
const allResearched = () => Object.fromEntries(RESEARCH_IDS.map((r) => [r, true]));

describe('automation research gate (#193)', () => {
  it('maps each building to the research whose effect declares it', () => {
    for (const r of RESEARCH_IDS) {
      const b = RESEARCHES[r].effect.unlocksBuilding;
      if (b) expect(researchUnlocking(b)).toBe(r);
    }
    expect(GATED.length).toBeGreaterThan(0);
    expect(GATED).toContain('nursery');
    expect(GATED).toContain('hatchery');
  });

  it('refuses a gated building while its research is missing, however rich the colony', () => {
    for (const b of GATED) {
      const s = rich();
      expect(autoBuildingLockedBy(b, s)).toBe(researchUnlocking(b));
      expect(canBuildAuto(b, s)).toBe(false);
      expect(buildAuto(b, s)).toBe(s);
    }
  });

  it('allows a gated building once its research is complete', () => {
    for (const b of GATED) {
      const s = rich({ [researchUnlocking(b)!]: true });
      expect(autoBuildingLockedBy(b, s)).toBeNull();
      expect(canBuildAuto(b, s)).toBe(true);
      expect(buildAuto(b, s).autoProduction.buildings[b]).toBeGreaterThan(s.autoProduction.buildings[b] ?? 0);
    }
  });

  it('leaves an ungated building buildable without any research', () => {
    for (const b of BUILDINGS.filter((x) => !GATED.includes(x))) {
      expect(autoBuildingLockedBy(b, rich())).toBeNull();
      expect(canBuildAuto(b, rich())).toBe(true);
    }
  });

  it('keeps a gated building a save already owns, and its production', () => {
    for (const b of GATED) {
      const owned = rich({}, { [b]: 1 });
      const none = rich();
      expect(owned.autoProduction.buildings[b]).toBe(1);
      // The building still counts toward the rate even without its research.
      const ownedWithBase = { ...owned, autoProduction: { ...owned.autoProduction, researches: { basic_incubation: true } } };
      const noneWithBase = { ...none, autoProduction: { ...none.autoProduction, researches: { basic_incubation: true } } };
      expect(getAutoEggRate(ownedWithBase)).toBeGreaterThanOrEqual(getAutoEggRate(noneWithBase));
    }
  });
});

describe('automation research gate — no catch-22 (property)', () => {
  const levels = fc.record(
    Object.fromEntries(BUILDINGS.map((b) => [b, fc.integer({ min: 0, max: AUTOMATION_BUILDINGS[b].maxLevel })])),
  );
  const done = fc.record(Object.fromEntries(RESEARCH_IDS.map((r) => [r, fc.boolean()])));

  it('no research depends on owning an automation building', () => {
    fc.assert(
      fc.property(done, levels, levels, fc.constantFrom(...RESEARCH_IDS), (researches, a, b, r) => {
        const withA = rich(researches, a);
        const withB = rich(researches, b);
        expect(canResearch(r, withA)).toBe(canResearch(r, withB));
      }),
    );
  });

  it('researching in prerequisite order, with no buildings, reaches every gating research and opens every building', () => {
    let s = rich();
    const pending = new Set(RESEARCH_IDS);
    // Buy whatever is open until nothing more opens. Never build anything.
    for (let guard = 0; pending.size > 0 && guard < RESEARCH_IDS.length; guard++) {
      for (const r of pending) {
        if (canResearch(r, s)) {
          s = research(r, s);
          pending.delete(r);
        }
      }
    }
    expect([...pending]).toEqual([]);
    for (const b of BUILDINGS) {
      expect(s.autoProduction.buildings[b] ?? 0).toBe(0);
      expect(canBuildAuto(b, s)).toBe(true);
    }
  });

  it('a gated building is buildable exactly when its research is done (given resources and room)', () => {
    fc.assert(
      fc.property(done, fc.constantFrom(...GATED), (researches, b) => {
        const s = rich(researches);
        expect(canBuildAuto(b, s)).toBe(researches[researchUnlocking(b)!] === true);
      }),
    );
  });

  it('with every research done, the gate never blocks a building', () => {
    fc.assert(
      fc.property(levels, fc.constantFrom(...BUILDINGS), (lv, b) => {
        expect(autoBuildingLockedBy(b, rich(allResearched(), lv))).toBeNull();
      }),
    );
  });
});
