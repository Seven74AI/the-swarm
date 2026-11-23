import { DAY_MS } from '../data/constants';
import { simBalance } from '../data/balance/sim';

/**
 * One check-in of the simulated player (Story 3.7, AR15): `awayMs` of real
 * time away (resumed in one `resume(awayMs)`, the offline path from 60 s on),
 * then `activeMs` of play.
 */
export interface CheckIn {
  readonly awayMs: number;
  readonly activeMs: number;
  /**
   * Story 9.1: `activeMs` is only a ceiling. The player leaves after the first
   * look that lands nothing (no move, no tap), so the check-in's length is
   * measured; the time left unplayed joins the next gap, so every check-in
   * still starts at its planned time.
   */
  readonly untilIdle?: boolean;
}

/** A list of check-ins in real-time order (architecture N2). */
export type CheckInSchedule = readonly CheckIn[];

export interface DailyScheduleOptions {
  readonly perDay?: number;
  readonly activeMs?: number;
  readonly wakingMs?: number;
}

/**
 * `days` days of check-ins: `perDay` a day, evenly spread over the waking
 * day, with the overnight gap before each day's first. The first check-in
 * has no gap (the run starts with the player there), and each day's first
 * check-in starts a whole day after the one before.
 */
export function dailySchedule(days: number, options: DailyScheduleOptions = {}): CheckInSchedule {
  const perDay = Math.max(1, Math.floor(options.perDay ?? simBalance.checkInsPerDay));
  const activeMs = Math.floor(options.activeMs ?? simBalance.checkInActiveMs);
  const wakingMs = Math.floor(options.wakingMs ?? simBalance.wakingMs);
  const interval = perDay > 1 ? Math.floor(wakingMs / (perDay - 1)) : 0;
  const out: CheckIn[] = [];
  let lastEnd = 0;
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < perDay; i++) {
      const start = d * DAY_MS + i * interval;
      out.push({ awayMs: Math.max(0, start - lastEnd), activeMs });
      lastEnd = start + activeMs;
    }
  }
  return out;
}

/** How long each check-in of day `day` (from 1) is played in the first week; session 1 aside. */
function firstWeekSessionMs(day: number): number {
  const fw = simBalance.firstWeek;
  if (day <= fw.earlyDays) return fw.earlySessionMs;
  // Days earlyDays+1 … weekDays shrink linearly toward the steady state, never reaching it.
  const steps = fw.weekDays - fw.earlyDays + 1;
  const into = day - fw.earlyDays;
  return Math.floor(fw.earlySessionMs - ((fw.earlySessionMs - fw.steadySessionMs) * into) / steps);
}

/**
 * Story 9.1 (FR54, GDD *Session Shape*): `days` days of the first week as a
 * player lives it. Session 1 starts the run (no gap) and is one continuous
 * session; every day holds `checkInsPerDay` check-ins spread over the waking
 * day like `dailySchedule` (session 1 is day 1's first). Sessions last
 * `earlySessionMs` through the early days, then shrink day by day; after the
 * week each check-in is played until the player has nothing useful left
 * (`untilIdle`, capped by `checkInCeilingMs`). The shape is `simBalance.firstWeek`.
 */
export function firstWeekSchedule(days: number): CheckInSchedule {
  const fw = simBalance.firstWeek;
  const perDay = Math.max(1, Math.floor(simBalance.checkInsPerDay));
  const interval = perDay > 1 ? Math.floor(simBalance.wakingMs / (perDay - 1)) : 0;
  const out: CheckIn[] = [];
  let lastEnd = 0;
  for (let d = 0; d < days; d++) {
    const day = d + 1;
    const after = day > fw.weekDays;
    for (let i = 0; i < perDay; i++) {
      const start = d * DAY_MS + i * interval;
      const activeMs = d === 0 && i === 0 ? fw.session1Ms : after ? fw.checkInCeilingMs : firstWeekSessionMs(day);
      out.push({ awayMs: Math.max(0, start - lastEnd), activeMs, ...(after ? { untilIdle: true } : {}) });
      lastEnd = start + activeMs;
    }
  }
  return out;
}

/** `count` copies of one check-in. */
export function repeatCheckIns(count: number, checkIn: CheckIn): CheckInSchedule {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, () => checkIn);
}

/** The real time a schedule spans: every gap and every check-in. */
export function scheduleMs(schedule: CheckInSchedule): number {
  return schedule.reduce((t, c) => t + c.awayMs + c.activeMs, 0);
}
