/**
 * What the resource sheet showed when it last opened this session (Story
 * 9.11): wall-clock time, food and the food net rate. In memory only, never
 * saved: a reload starts a new session, and the first opening shows no
 * `SINCE` line.
 */
export interface SheetMoment {
  readonly atMs: number;
  readonly food: number;
  readonly netPerSec: number;
}

let last: SheetMoment | null = null;

/** The moment the sheet last opened, then record this one; returns the earlier (null the first time). */
export function sheetOpened(now: SheetMoment): SheetMoment | null {
  const before = last;
  last = now;
  return before;
}

/** Forget the session's openings (tests). */
export function resetSheetSince(): void {
  last = null;
}
