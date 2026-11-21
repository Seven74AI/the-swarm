// @vitest-environment node
/**
 * Story 3.10 (FR38): "decisions available" is the choices a player has on
 * arrival: each item they can buy now, plus CONTINUE when the goal has
 * latched. Telemetry and the headless sim (Story 3.7) count it the same way.
 */
import { describe, expect, it } from 'vitest';
import { decisionsAvailable, isItemAffordable, listItems } from '../../../src/systems/NextAction';
import { Phase } from '../../../src/phases/phases';
import { makeState } from '../helpers/makeState';

const broke = () =>
  makeState({
    phase: Phase.COLONY,
    resources: { eggs: 0, larvae: 0, workers: 0, food: 0, wood: 0, stone: 0, nectar: 0 },
  });

describe('decisionsAvailable (Story 3.10)', () => {
  it('is a whole number, never negative', () => {
    for (const s of [makeState(), broke()]) {
      const n = decisionsAvailable(s);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  it('counts every affordable item once', () => {
    const rich = makeState({
      phase: Phase.COLONY,
      resources: { eggs: 1e6, larvae: 1e6, workers: 1e4, food: 1e9, wood: 1e9, stone: 1e9, nectar: 1e9, nestCapacity: 1e9 },
    });
    const affordable = listItems().filter((ref) => isItemAffordable(rich, ref)).length;
    expect(affordable).toBeGreaterThan(0);
    expect(decisionsAvailable(rich)).toBeGreaterThanOrEqual(affordable);
    expect(decisionsAvailable(rich)).toBeGreaterThan(decisionsAvailable(broke()));
  });

  it('a latched goal adds CONTINUE as one more decision', () => {
    const before = broke();
    const latched = { ...before, phaseGoal: { phase: Phase.COMBAT, latched: true as const, atMs: 0, reached: {} } };
    expect(decisionsAvailable(latched)).toBe(decisionsAvailable(before) + 1);
  });
});
