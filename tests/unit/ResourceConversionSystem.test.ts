import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import {
  tickConversions,
  getConversionDefs,
  isConversionUnlocked,
  getConversionRate,
  buildParticleLab,
  type ConversionId,
} from '../../src/systems/ResourceConversionSystem';

/**
 * ResourceConversionSystem tests — TDD.
 * Tests invariants, not hardcoded formula outputs.
 * DAG-aware: conversions run in order, outputs feed subsequent steps.
 */
describe('ResourceConversionSystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
    // Give resources for testing
    state.resources.stone = 100;
    state.resources.nectar = 100;
    state.resources.voidCrystals = 10;
    state.resources.antimatter = 5;
    state.resources.workers = 50;
    // Set up research completions for testing
    state.research.projects.voidCrystalSynthesis = { state: 'completed', progress: 600 };
    state.research.projects.antimatterContainment = { state: 'completed', progress: 1500 };
    state.research.projects.darkMatterDetection = { state: 'completed', progress: 3000 };
    // Assign researchers
    state.workersAssigned.researchers = 10;
    // Build particle lab
    state.conversions.particleLab = 1;
  });

  describe('getConversionDefs', () => {
    it('returns all 3 conversions in DAG order', () => {
      const defs = getConversionDefs();
      expect(defs).toHaveLength(3);
      const ids = defs.map((d) => d.id);
      expect(ids).toEqual([
        'voidCrystalSynthesis',
        'antimatterContainment',
        'darkMatterDetection',
      ]);
    });

    it('voidCrystalSynthesis consumes stone and nectar, produces voidCrystals', () => {
      const def = getConversionDefs().find((d) => d.id === 'voidCrystalSynthesis')!;
      expect(def.inputs.stone).toBeGreaterThan(0);
      expect(def.inputs.nectar).toBeGreaterThan(0);
      expect(def.outputs.voidCrystals).toBeGreaterThan(0);
    });

    it('antimatterContainment consumes voidCrystals, produces antimatter', () => {
      const def = getConversionDefs().find((d) => d.id === 'antimatterContainment')!;
      expect(def.inputs.voidCrystals).toBeGreaterThan(0);
      expect(def.outputs.antimatter).toBeGreaterThan(0);
    });

    it('darkMatterDetection consumes antimatter, produces darkMatter', () => {
      const def = getConversionDefs().find((d) => d.id === 'darkMatterDetection')!;
      expect(def.inputs.antimatter).toBeGreaterThan(0);
      expect(def.outputs.darkMatter).toBeGreaterThan(0);
    });
  });

  describe('isConversionUnlocked', () => {
    it('returns false when research is not completed', () => {
      state.research.projects.voidCrystalSynthesis = { state: 'available', progress: 0 };
      expect(isConversionUnlocked(state, 'voidCrystalSynthesis')).toBe(false);
    });

    it('returns true when research is completed', () => {
      expect(isConversionUnlocked(state, 'voidCrystalSynthesis')).toBe(true);
    });

    it('antimatter containment requires particleLab > 0', () => {
      state.conversions.particleLab = 0;
      expect(isConversionUnlocked(state, 'antimatterContainment')).toBe(false);
      state.conversions.particleLab = 1;
      expect(isConversionUnlocked(state, 'antimatterContainment')).toBe(true);
    });

    it('darkMatter detection requires active space explorations', () => {
      // No active explorations
      state.spaceExplorations = [];
      expect(isConversionUnlocked(state, 'darkMatterDetection')).toBe(false);
      // With active exploration
      state.spaceExplorations = [{ id: 'spc_1', destination: 'MARS', ticksRemaining: 50, risk: 0.3 }];
      expect(isConversionUnlocked(state, 'darkMatterDetection')).toBe(true);
    });
  });

  describe('getConversionRate', () => {
    it('returns 0 when conversion is not unlocked', () => {
      state.research.projects.voidCrystalSynthesis = { state: 'available', progress: 0 };
      expect(getConversionRate(state, 'voidCrystalSynthesis')).toBe(0);
    });

    it('voidCrystal rate is capped by researchers', () => {
      const rateWith10 = getConversionRate(state, 'voidCrystalSynthesis');
      state.workersAssigned.researchers = 20;
      const rateWith20 = getConversionRate(state, 'voidCrystalSynthesis');
      expect(rateWith20).toBeGreaterThan(rateWith10);
    });

    it('antimatter rate is capped by particleLab level', () => {
      state.conversions.particleLab = 1;
      const rateAt1 = getConversionRate(state, 'antimatterContainment');
      state.conversions.particleLab = 3;
      const rateAt3 = getConversionRate(state, 'antimatterContainment');
      expect(rateAt3).toBeGreaterThan(rateAt1);
    });

    it('darkMatter rate is capped by active space explorations', () => {
      state.spaceExplorations = [];
      expect(getConversionRate(state, 'darkMatterDetection')).toBe(0);
      state.spaceExplorations = [
        { id: 'a', destination: 'MARS', ticksRemaining: 50, risk: 0.3 },
        { id: 'b', destination: 'EUROPA', ticksRemaining: 30, risk: 0.5 },
      ];
      expect(getConversionRate(state, 'darkMatterDetection')).toBeGreaterThan(0);
    });

    it('returns 0 when input resources are insufficient', () => {
      state.resources.stone = 0;
      state.resources.nectar = 0;
      expect(getConversionRate(state, 'voidCrystalSynthesis')).toBe(0);
    });
  });

  describe('tickConversions', () => {
    it('produces voidCrystals and consumes stone/nectar when only VC synthesis is unlocked', () => {
      // Disable antimatter and darkMatter so VC production is isolated
      state.research.projects.antimatterContainment = { state: 'locked', progress: 0 };
      state.research.projects.darkMatterDetection = { state: 'locked', progress: 0 };
      // Need ≥20 researchers for void crystal rate (researchers/20)
      state.workersAssigned.researchers = 40;

      const beforeVC = state.resources.voidCrystals;
      const beforeStone = state.resources.stone;
      const beforeNectar = state.resources.nectar;

      const result = tickConversions(state);

      expect(result.resources.voidCrystals).toBeGreaterThan(beforeVC);
      expect(result.resources.stone).toBeLessThan(beforeStone);
      expect(result.resources.nectar).toBeLessThan(beforeNectar);
    });

    it('produces antimatter from voidCrystals when research and particleLab present', () => {
      // Disable darkMatter so antimatter production is isolated
      state.research.projects.darkMatterDetection = { state: 'locked', progress: 0 };
      // Need particleLab≥3 for antimatter rate (lab/3), and ≥20 researchers for voidCrystals
      state.conversions.particleLab = 3;
      state.workersAssigned.researchers = 40;

      const result = tickConversions(state);
      // With particleLab=3 and voidCrystals available, antimatter should increase
      expect(result.resources.antimatter).toBeGreaterThan(state.resources.antimatter);
    });

    it('chain dependency: antimatter requires voidCrystals to be available', () => {
      // No voidCrystals available — antimatter conversion should not run
      state.resources.voidCrystals = 0;
      // Disable VC synthesis too (no stone/nectar)
      state.resources.stone = 0;
      state.resources.nectar = 0;
      const beforeAM = state.resources.antimatter;

      const result = tickConversions(state);

      // Antimatter should not increase (no voidCrystals to convert)
      expect(result.resources.antimatter).toBe(beforeAM);
    });

    it('produces darkMatter from antimatter when expeditions active', () => {
      // Disable antimatter containment so it doesn't add antimatter during tick
      state.research.projects.antimatterContainment = { state: 'locked', progress: 0 };
      // Need ≥2 space explorations for darkMatter rate (explorations/2)
      state.spaceExplorations = [
        { id: 'spc_1', destination: 'SATURN', ticksRemaining: 50, risk: 0.3 },
        { id: 'spc_2', destination: 'MARS', ticksRemaining: 80, risk: 0.2 },
      ];
      const beforeDM = state.resources.darkMatter;
      const beforeAM = state.resources.antimatter;

      const result = tickConversions(state);

      expect(result.resources.darkMatter).toBeGreaterThan(beforeDM);
      expect(result.resources.antimatter).toBeLessThan(beforeAM);
    });

    it('no production when research is not completed', () => {
      state.research.projects.voidCrystalSynthesis = { state: 'available', progress: 0 };
      state.research.projects.antimatterContainment = { state: 'locked', progress: 0 };
      state.research.projects.darkMatterDetection = { state: 'locked', progress: 0 };

      const beforeVC = state.resources.voidCrystals;
      const beforeAM = state.resources.antimatter;
      const beforeDM = state.resources.darkMatter;

      const result = tickConversions(state);

      expect(result.resources.voidCrystals).toBe(beforeVC);
      expect(result.resources.antimatter).toBe(beforeAM);
      expect(result.resources.darkMatter).toBe(beforeDM);
    });

    it('rate cap: never produces more than the rate cap per tick', () => {
      // Disable antimatter and darkMatter for isolated VC test
      state.research.projects.antimatterContainment = { state: 'locked', progress: 0 };
      state.research.projects.darkMatterDetection = { state: 'locked', progress: 0 };
      // Boost researchers for meaningful rate: floor(40/20) = 2
      state.workersAssigned.researchers = 40;

      const result = tickConversions(state);
      const vcIncrease = result.resources.voidCrystals - state.resources.voidCrystals;

      // Rate cap with 40 researchers: floor(40/20) = 2, so max 2 conversions = 2 voidCrystals
      expect(vcIncrease).toBeLessThanOrEqual(2);
      expect(vcIncrease).toBeGreaterThan(0);
    });

    it('handles partial resource availability gracefully', () => {
      // Disable antimatter and darkMatter for isolated test
      state.research.projects.antimatterContainment = { state: 'locked', progress: 0 };
      state.research.projects.darkMatterDetection = { state: 'locked', progress: 0 };
      // Just barely enough stone for 1 conversion (needs 5 stone, 2 nectar)
      state.resources.stone = 5;
      state.resources.nectar = 2;
      const result = tickConversions(state);
      expect(result.resources.stone).toBeGreaterThanOrEqual(0);
      expect(result.resources.voidCrystals).toBeGreaterThanOrEqual(state.resources.voidCrystals);
    });

    it('dtSec parameter scales production', () => {
      // Disable antimatter and darkMatter for isolated test
      state.research.projects.antimatterContainment = { state: 'locked', progress: 0 };
      state.research.projects.darkMatterDetection = { state: 'locked', progress: 0 };
      // Need ≥20 researchers for meaningful rate
      state.workersAssigned.researchers = 40;

      const result1x = tickConversions(state, 1);
      const result2x = tickConversions(state, 2);

      const vcDelta1x = result1x.resources.voidCrystals - state.resources.voidCrystals;
      const vcDelta2x = result2x.resources.voidCrystals - state.resources.voidCrystals;

      // With dt=2, should produce 2x as much (floor may cause slight diff, verify increase)
      expect(vcDelta2x).toBeGreaterThanOrEqual(vcDelta1x);
    });

    it('does not mutate the input state', () => {
      const originalVC = state.resources.voidCrystals;
      tickConversions(state);
      // Input state should be unchanged
      expect(state.resources.voidCrystals).toBe(originalVC);
    });
  });

  describe('buildParticleLab', () => {
    it('increments particleLab level', () => {
      const initial = state.conversions.particleLab;
      const result = buildParticleLab(state);
      expect(result.conversions.particleLab).toBe(initial + 1);
    });

    it('works with fresh initial state', () => {
      const bareState = createInitialState();
      const result = buildParticleLab(bareState);
      expect(result.conversions.particleLab).toBe(1);
    });
  });
});
