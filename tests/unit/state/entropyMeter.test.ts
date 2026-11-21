import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { gameState } from '../../../src/state/gameSignal';
import { createInitialState } from '../../../src/state/GameState';
import { selectEntropyMeter } from '../../../src/state/selectors';
import { entropyMeter } from '../../../src/state/queries';
import { ENTROPY_MAX, tickEntropy } from '../../../src/systems/EntropySystem';

/**
 * Story 3.3 (FR34): entropy is a 0–100 meter, not a resource. It lives
 * outside `state.resources`, is shown rounded to a whole percent and is never
 * spent (no cost table names it: see tests/unit/wholeCosts.test.ts).
 */
describe('entropy is a meter (Story 3.3)', () => {
  afterEach(() => {
    gameState.value = createInitialState();
  });

  it('lives outside state.resources', () => {
    const s = createInitialState();
    expect(Object.keys(s.resources)).not.toContain('entropy');
    expect(typeof s.entropy).toBe('number');
  });

  it('is shown as a whole percent between 0 and the maximum', () => {
    fc.assert(
      fc.property(fc.double({ min: -50, max: 250, noNaN: true }), (entropy) => {
        const shown = entropyMeter({ ...createInitialState(), entropy });
        expect(Number.isInteger(shown)).toBe(true);
        expect(shown).toBeGreaterThanOrEqual(0);
        expect(shown).toBeLessThanOrEqual(ENTROPY_MAX);
        if (entropy >= 0 && entropy <= ENTROPY_MAX) expect(Math.abs(shown - entropy)).toBeLessThanOrEqual(0.5);
      }),
      { seed: 33, numRuns: 200 },
    );
  });

  it('the selector gives the rounded meter', () => {
    const s = createInitialState();
    s.resources.darkMatter = 7;
    const ticked = tickEntropy(s, 0.37);
    expect(Number.isInteger(ticked.entropy)).toBe(false);
    gameState.value = ticked;
    expect(selectEntropyMeter.value).toBe(entropyMeter(ticked));
    expect(Number.isInteger(selectEntropyMeter.value)).toBe(true);
  });
});
