import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import {
  getEntropyRate,
  tickEntropy,
  isEntropyThreshold,
  getEntropyThresholdLevel,
  getActiveThresholdEffects,
  buildEntropyDampener,
  getEntropyDampenerLevel,
  ENTROPY_DAMPENER_COST_VOID_CRYSTALS,
  ENTROPY_DAMPENER_COST_STONE,
  resetEntropy,
  ENTROPY_MAX,
  ENTROPY_RATE_PER_DARK_MATTER,
} from '../../src/systems/EntropySystem';

/**
 * EntropySystem tests — TDD RED phase.
 * EntropySystem module does not exist yet, these tests document the API.
 * Tests invariants, not hardcoded formula outputs.
 */
describe('EntropySystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  describe('getEntropyRate', () => {
    it('returns 0 when darkMatter is 0', () => {
      state.resources.darkMatter = 0;
      expect(getEntropyRate(state)).toBe(0);
    });

    it('returns rate proportional to darkMatter production', () => {
      state.resources.darkMatter = 10;
      const rate = getEntropyRate(state);
      expect(rate).toBeGreaterThan(0);
      // Rate should be darkMatter * ENTROPY_RATE_PER_DARK_MATTER
      expect(rate).toBe(10 * ENTROPY_RATE_PER_DARK_MATTER);
    });

    it('rate grows linearly with darkMatter', () => {
      state.resources.darkMatter = 5;
      const rate5 = getEntropyRate(state);
      state.resources.darkMatter = 15;
      const rate15 = getEntropyRate(state);
      expect(rate15).toBeGreaterThan(rate5);
    });
  });

  describe('tickEntropy', () => {
    it('accumulates entropy based on darkMatter rate', () => {
      state.resources.darkMatter = 20;
      const before = state.entropy ?? 0;
      const result = tickEntropy(state, 1.0);
      expect(result.entropy).toBeGreaterThan(before);
    });

    it('does not accumulate entropy when darkMatter is 0', () => {
      state.resources.darkMatter = 0;
      const before = state.entropy ?? 0;
      const result = tickEntropy(state, 1.0);
      expect(result.entropy).toBe(before);
    });

    it('scales entropy accumulation with dtSec', () => {
      state.resources.darkMatter = 20;
      const result1 = tickEntropy(state, 1.0);
      const result2 = tickEntropy(state, 2.0);
      // Double dt should produce roughly double entropy (allow float variance)
      const delta1 = result1.entropy - (state.entropy ?? 0);
      const delta2 = result2.entropy - (state.entropy ?? 0);
      expect(delta2).toBeGreaterThanOrEqual(delta1 * 1.9);
    });

    it('clamps entropy to ENTROPY_MAX (100%)', () => {
      state.resources.darkMatter = 1000; // generate huge rate
      // Set entropy already near max
      const alreadyHigh = { ...state, entropy: ENTROPY_MAX - 0.01 };
      const result = tickEntropy(alreadyHigh, 1.0);
      expect(result.entropy).toBeLessThanOrEqual(ENTROPY_MAX);
    });
  });

  describe('isEntropyThreshold + getEntropyThresholdLevel', () => {
    it('returns false when entropy is below 25%', () => {
      const s = { ...state, entropy: 20 };
      expect(isEntropyThreshold(s)).toBe(false);
    });

    it('returns level 25 when entropy reaches 25%', () => {
      const s = { ...state, entropy: 25 };
      expect(getEntropyThresholdLevel(s)).toBe(25);
    });

    it('returns level 50 when entropy reaches 50%', () => {
      const s = { ...state, entropy: 50 };
      expect(getEntropyThresholdLevel(s)).toBe(50);
    });

    it('returns level 75 when entropy reaches 75%', () => {
      const s = { ...state, entropy: 75 };
      expect(getEntropyThresholdLevel(s)).toBe(75);
    });

    it('returns level 100 when entropy reaches 100%', () => {
      const s = { ...state, entropy: 100 };
      expect(getEntropyThresholdLevel(s)).toBe(100);
    });
  });

  describe('getActiveThresholdEffects', () => {
    it('returns empty array when entropy is below 25%', () => {
      const s = { ...state, entropy: 10 };
      const effects = getActiveThresholdEffects(s);
      expect(effects).toHaveLength(0);
    });

    it('returns 25% effect when entropy crosses 25%', () => {
      const s = { ...state, entropy: 30 };
      const effects = getActiveThresholdEffects(s);
      expect(effects.length).toBeGreaterThanOrEqual(1);
      const names = effects.map((e) => e.name);
      expect(names).toContain('void_rift');
    });

    it('returns multiple effects at high entropy', () => {
      const s = { ...state, entropy: 80 };
      const effects = getActiveThresholdEffects(s);
      expect(effects.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Entropy Dampener building', () => {
    it('ENTROPY_DAMPENER_COST_VOID_CRYSTALS is a positive integer', () => {
      expect(ENTROPY_DAMPENER_COST_VOID_CRYSTALS).toBeGreaterThan(0);
      expect(Number.isInteger(ENTROPY_DAMPENER_COST_VOID_CRYSTALS)).toBe(true);
    });

    it('ENTROPY_DAMPENER_COST_STONE is a positive integer', () => {
      expect(ENTROPY_DAMPENER_COST_STONE).toBeGreaterThan(0);
      expect(Number.isInteger(ENTROPY_DAMPENER_COST_STONE)).toBe(true);
    });

    it('getEntropyDampenerLevel returns current level', () => {
      const s = { ...state, entropyDampener: { level: 3 } };
      expect(getEntropyDampenerLevel(s)).toBe(3);
    });

    it('getEntropyDampenerLevel returns 0 when dampener is not built', () => {
      expect(getEntropyDampenerLevel(state)).toBe(0);
    });

    it('buildEntropyDampener consumes voidCrystals and stone', () => {
      state.resources.voidCrystals = 50;
      state.resources.stone = 100;
      const result = buildEntropyDampener(state);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.resources.voidCrystals).toBeLessThan(state.resources.voidCrystals);
        expect(result.resources.stone).toBeLessThan(state.resources.stone);
        expect(result.entropyDampener.level).toBeGreaterThan(state.entropyDampener.level);
      }
    });

    it('buildEntropyDampener returns null when resources insufficient', () => {
      state.resources.voidCrystals = 0;
      state.resources.stone = 0;
      const result = buildEntropyDampener(state);
      expect(result).toBeNull();
    });

    it('dampener reduces entropy rate by 20% per level', () => {
      state.resources.darkMatter = 20;
      const baseRate = getEntropyRate(state);

      // Build one level of dampener
      const withDampener = {
        ...state,
        entropyDampener: { level: 1 },
      };
      const dampenedRate = getEntropyRate(withDampener);

      // 20% reduction per level means rate should be 80% of original
      expect(dampenedRate).toBeLessThan(baseRate);
      expect(dampenedRate).toBeCloseTo(baseRate * 0.8, 0);
    });

    it('dampener stacks multiplicatively per level', () => {
      state.resources.darkMatter = 20;
      const baseRate = getEntropyRate(state);

      const withLevel2 = {
        ...state,
        entropyDampener: { level: 2 },
      };
      // Level 2: 0.8 * 0.8 = 0.64
      expect(getEntropyRate(withLevel2)).toBeCloseTo(baseRate * 0.64, 0);
    });
  });

  describe('resetEntropy', () => {
    it('resets entropy to 0 on prestige', () => {
      const s = { ...state, entropy: 75 };
      const result = resetEntropy(s);
      expect(result.entropy).toBe(0);
    });

    it('preserves entropyDampener level on reset', () => {
      const s = {
        ...state,
        entropy: 80,
        entropyDampener: { level: 2 },
      };
      const result = resetEntropy(s);
      expect(result.entropyDampener.level).toBe(2);
    });
  });

  describe('ENTROPY_MAX constant', () => {
    it('is 100 (representing percentage)', () => {
      expect(ENTROPY_MAX).toBe(100);
    });
  });

  describe('ENTROPY_RATE_PER_DARK_MATTER constant', () => {
    it('is 0.1 per the spec', () => {
      expect(ENTROPY_RATE_PER_DARK_MATTER).toBe(0.1);
    });
  });
});
