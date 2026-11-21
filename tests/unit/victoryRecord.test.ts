import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { GameState } from '../../src/state/GameState';
import { arbCommand, arbState, describeCmd, harness } from './helpers/randomPlay';

/**
 * Story 5.5 (FR31): the victory record changes nothing. Two colonies that
 * differ only in `victoryAchieved` stay identical (but for the record) through
 * any sequence of live ticks, actions and offline catch-ups. Reaching
 * Transcendence records the victory in both, after which they are equal.
 */

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const withoutRecord = ({ victoryAchieved: _v, ...rest }: GameState) => rest;

describe('the victory record is not a reward (Story 5.5)', () => {
  it('two states that differ only in victoryAchieved stay identical through any ticks and actions', () => {
    fc.assert(
      fc.property(arbState, fc.array(arbCommand, { minLength: 1, maxLength: 20 }), (initial, commands) => {
        const won = harness({ ...structuredClone(initial), victoryAchieved: true });
        const notYet = harness({ ...structuredClone(initial), victoryAchieved: false });
        commands.forEach((cmd, i) => {
          won.run(cmd);
          notYet.run(cmd);
          expect(withoutRecord(notYet.get()), `after #${i} ${describeCmd(cmd)}`).toEqual(withoutRecord(won.get()));
          // A record, once written, is never taken away.
          expect(won.get().victoryAchieved).toBe(true);
        });
      }),
      { seed: 5_5, numRuns: 60 },
    );
  });
});
