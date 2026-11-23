import { describe, expect, it } from 'vitest';
import { TRANSITIONS } from '../../../src/phases/transitions';
import { PHASE_ORDER } from '../../../src/phases/phases';
import { createInitialState } from '../../../src/state/GameState';

/**
 * Story 9.9 (FR64): the worker count each goal asks for strictly increases
 * along the phase order, so a later phase never asks for fewer workers than
 * the colony already needed to leave an earlier one.
 */
describe('worker targets along the phase order', () => {
  it('strictly increase from one phase goal to the next', () => {
    const s = createInitialState();
    const targets = [...TRANSITIONS]
      .sort((a, b) => PHASE_ORDER.indexOf(a.from) - PHASE_ORDER.indexOf(b.from))
      .map((t) => t.conditions.find((c) => c.id === 'workers'))
      .filter((c) => c !== undefined)
      .map((c) => c!.target(s));
    expect(targets.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < targets.length; i++) expect(targets[i], `goal ${i}`).toBeGreaterThan(targets[i - 1]);
  });
});
