import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { GameState } from '../../../src/state/GameState';
import { arbCommand, arbState, describeCmd, harness } from '../helpers/randomPlay';
/**
 * Story 3.3 (FR34, AR20): every count is a whole number.
 *
 * A property test: random seeded states run through a random mix of live
 * ticks (any step length up to a catch-up macro-step), player actions and
 * offline catch-ups. After EVERY step each value in `state.resources` (and the
 * other counted stocks: combat loot, soldiers) is an integer ≥ 0, and entropy
 * (a meter, not a resource) stays in 0–100 and no action but prestige lowers it.
 *
 * Deterministic: fast-check runs from a fixed seed, and every draw the
 * simulation makes comes from the state's own generator (`state.rng`,
 * Story 3.1), which each random state sets from that seed.
 */

const SEED = 3_3;
const RUNS = 100;
const MAX_COMMANDS = 25;

beforeEach(() => {
  // Each catch-up logs one summary line; keep the run quiet.
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function expectWhole(s: GameState, where: string): void {
  for (const [key, value] of Object.entries(s.resources)) {
    expect(Number.isInteger(value), `${where}: resources.${key} = ${value} is an integer`).toBe(true);
    expect(value, `${where}: resources.${key} ≥ 0`).toBeGreaterThanOrEqual(0);
  }
  // The other stocks the colony counts and spends: combat loot and soldiers.
  const counts = { ...s.combatResources, combatSoldiers: s.combatSoldiers, scouts: s.soldiers.scouts, warriors: s.soldiers.warriors };
  for (const [key, value] of Object.entries(counts)) {
    expect(Number.isInteger(value) && value >= 0, `${where}: ${key} = ${value} is a whole number`).toBe(true);
  }
  expect(s.entropy, `${where}: entropy is a 0–100 meter`).toBeGreaterThanOrEqual(0);
  expect(s.entropy, `${where}: entropy is a 0–100 meter`).toBeLessThanOrEqual(100);
}

describe('every resource is a whole number (Story 3.3)', () => {
  it('stays an integer ≥ 0 through random ticks, actions and catch-ups', () => {
    fc.assert(
      fc.property(arbState, fc.array(arbCommand, { minLength: 1, maxLength: MAX_COMMANDS }), (initial, commands) => {
        const h = harness(initial, (name, before, after) => {
          // Entropy is a meter, never spent: only prestige resets it.
          if (name !== 'prestige') expect(after.entropy, `${name} spends no entropy`).toBeGreaterThanOrEqual(before.entropy);
        });
        expectWhole(h.get(), 'seed state');
        commands.forEach((cmd, i) => {
          h.run(cmd);
          expectWhole(h.get(), `after #${i} ${describeCmd(cmd)}`);
        });
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
