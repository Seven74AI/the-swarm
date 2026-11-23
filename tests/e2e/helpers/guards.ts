import { goalFor } from '../../../src/phases/transitions';
import { createInitialState } from '../../../src/state/GameState';

/**
 * A phase goal's target for one condition, read from `transitions.ts` (the
 * only guard source), so a seed that must meet or latch a goal never restates
 * a tuned number (Story 9.9 retuned them).
 */
export function goalTarget(phase: string, id: string): number {
  const c = goalFor(phase)?.conditions.find((x) => x.id === id);
  if (!c) throw new Error(`no ${id} condition on the ${phase} goal`);
  return c.target(createInitialState());
}
