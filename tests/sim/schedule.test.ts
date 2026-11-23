// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { dailySchedule, firstWeekSchedule, repeatCheckIns, scheduleMs } from '../../src/sim/schedule';
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

/** Story 9.1 (FR54): the first-week schedule follows the GDD's session shape. */
describe('firstWeekSchedule', () => {
  const fw = simBalance.firstWeek;
  const days = fw.weekDays + 3;
  const s = firstWeekSchedule(days);
  const starts = s.map((_, i) => scheduleMs(s.slice(0, i)) + s[i].awayMs);
  const dayOf = (i: number) => Math.floor(starts[i] / DAY_MS) + 1;

  it('is in real-time order: whole, non-negative gaps and strictly later starts', () => {
    for (const c of s) {
      expect(Number.isInteger(c.awayMs)).toBe(true);
      expect(Number.isInteger(c.activeMs)).toBe(true);
      expect(c.awayMs).toBeGreaterThanOrEqual(0);
      expect(c.activeMs).toBeGreaterThan(0);
    }
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1] + s[i - 1].activeMs - 1);
  });

  it('opens with session 1: no gap, one continuous check-in longer than any other', () => {
    expect(s[0].awayMs).toBe(0);
    expect(s[0].activeMs).toBe(fw.session1Ms);
    expect(s[0].untilIdle ?? false).toBe(false);
    for (const c of s.slice(1)) expect(c.activeMs).toBeLessThan(s[0].activeMs);
  });

  it('holds the same number of check-ins every day, the first day included, and covers every day', () => {
    for (let d = 1; d <= days; d++) {
      expect(s.filter((_, i) => dayOf(i) === d)).toHaveLength(simBalance.checkInsPerDay);
    }
  });

  it('shortens the sessions after the early days, day by day, and never lengthens them', () => {
    const early = s.filter((_, i) => i > 0 && dayOf(i) <= fw.earlyDays).map((c) => c.activeMs);
    const later = s.filter((_, i) => dayOf(i) > fw.earlyDays && dayOf(i) <= fw.weekDays).map((c) => c.activeMs);
    expect(later.length).toBeGreaterThan(0);
    expect(Math.max(...later)).toBeLessThan(Math.min(...early));
    for (let i = 1; i < later.length; i++) expect(later[i]).toBeLessThanOrEqual(later[i - 1]);
    expect(later[later.length - 1]).toBeLessThan(later[0]);
  });

  it('after the week, plays each check-in until the player has nothing useful left, up to the ceiling', () => {
    s.forEach((c, i) => {
      const after = dayOf(i) > fw.weekDays;
      expect(c.untilIdle ?? false).toBe(after);
      if (after) expect(c.activeMs).toBe(fw.checkInCeilingMs);
    });
  });
});
