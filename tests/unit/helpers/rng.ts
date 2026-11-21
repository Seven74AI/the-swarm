import type { RngStream } from '../../../src/utils/rng';

/**
 * A stream that always draws `value` (Story 3.1): pass it where a system takes
 * an `RngStream` to pin a roll (e.g. a full-success expedition). Unit tests
 * use it in place of mocking Math.random, which the simulation no longer reads.
 */
export function fixedRng(value: number): RngStream {
  return { state: 0, float: () => value };
}
