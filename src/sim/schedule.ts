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

/** `count` copies of one check-in. */
export function repeatCheckIns(count: number, checkIn: CheckIn): CheckInSchedule {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, () => checkIn);
}

/** The real time a schedule spans: every gap and every check-in. */
export function scheduleMs(schedule: CheckInSchedule): number {
  return schedule.reduce((t, c) => t + c.awayMs + c.activeMs, 0);
}
