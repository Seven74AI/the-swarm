// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { dailySchedule, repeatCheckIns, scheduleMs } from '../../src/sim/schedule';
import { simBalance } from '../../src/data/balance/sim';
import { DAY_MS } from '../../src/data/constants';

/** Story 3.7 (AR15): the check-in schedule is a list of real-time gaps. */
describe('CheckInSchedule', () => {
  it('lays out the balance number of check-ins per day, starting with no gap', () => {
    const days = 2;
    const s = dailySchedule(days);
    expect(s).toHaveLength(days * simBalance.checkInsPerDay);
    expect(s[0].awayMs).toBe(0);
    for (const c of s) {
      expect(Number.isInteger(c.awayMs)).toBe(true);
      expect(Number.isInteger(c.activeMs)).toBe(true);
      expect(c.awayMs).toBeGreaterThanOrEqual(0);
      expect(c.activeMs).toBeGreaterThan(0);
    }
  });

  it('starts every day a full day after the one before', () => {
    const perDay = simBalance.checkInsPerDay;
    const s = dailySchedule(3);
    const startOf = (i: number) => scheduleMs(s.slice(0, i)) + s[i].awayMs;
    expect(startOf(perDay) - startOf(0)).toBe(DAY_MS);
    expect(startOf(2 * perDay) - startOf(perDay)).toBe(DAY_MS);
  });

  it('puts the longest gap overnight', () => {
    const perDay = simBalance.checkInsPerDay;
    const s = dailySchedule(2);
    const longest = Math.max(...s.map((c) => c.awayMs));
    expect(s[perDay].awayMs).toBe(longest);
    expect(s.slice(1, perDay).every((c) => c.awayMs < longest)).toBe(true);
  });

  it('repeats one check-in, and scheduleMs sums away and active time', () => {
    const s = repeatCheckIns(3, { awayMs: 10, activeMs: 5 });
    expect(s).toHaveLength(3);
    expect(scheduleMs(s)).toBe(45);
  });
});
