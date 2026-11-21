/**
 * Play telemetry (Story 3.10, FR38, NFR10, D12): a ring buffer of what play
 * looks like, kept beside the game and OUTSIDE the save, like the settings and
 * the intro flag. It never leaves the device by itself: the player exports it
 * as a file from the settings screen.
 *
 * It records two kinds of entry, oldest first, at most `TELEMETRY_MAX_ENTRIES`:
 * - `check_in`: one foreground session, from arrival (cold start or return to
 *   the page) to the page hiding. Its length, the time away before it, the
 *   phase and the decisions available on arrival (`decisionsAvailable` in
 *   systems/NextAction.ts, the count the headless sim uses too).
 * - `phase`: a phase left (CONTINUE, prestige or an imported save). Foreground
 *   time spent in it (`activeMs`, check-ins only) and wall time since entering
 *   it (`elapsedMs`, time away included).
 *
 * Pure and DOM-free: main gives it the clock and a `TelemetryStorage`
 * (platform's telemetry store) and calls it from the lifecycle signals and
 * phase events. Paused time counts as check-in time: the player is there.
 * A check-in cut short by a crash (no hide) is not recorded.
 */
import { TELEMETRY_MAX_ENTRIES } from '../data/constants';

export const TELEMETRY_FORMAT = 'the-swarm-telemetry' as const;
export const TELEMETRY_VERSION = 1 as const;
export const TELEMETRY_FILENAME = 'the-swarm-telemetry.json' as const;

export interface CheckInEntry {
  readonly kind: 'check_in';
  /** Wall clock (ms) at arrival. */
  readonly atMs: number;
  /** Time since the last check-in ended; null when there was none on this device. */
  readonly awayMs: number | null;
  readonly lengthMs: number;
  /** The phase on arrival. */
  readonly phase: string;
  /** The choices open on arrival: each affordable item, plus CONTINUE when latched. */
  readonly decisionsAvailable: number;
}

export interface PhaseEntry {
  readonly kind: 'phase';
  /** Wall clock (ms) when the phase was left. */
  readonly atMs: number;
  readonly phase: string;
  /** The phase that followed it. */
  readonly next: string;
  /** Foreground time in the phase (check-ins only). */
  readonly activeMs: number;
  /** Wall time from entering the phase to leaving it, time away included. */
  readonly elapsedMs: number;
}

export type TelemetryEntry = CheckInEntry | PhaseEntry;

/** The phase under way. */
export interface PhaseUnderWay {
  readonly phase: string;
  readonly enteredAtMs: number;
  readonly activeMs: number;
}

export interface TelemetrySnapshot {
  readonly entries: readonly TelemetryEntry[];
  readonly current: PhaseUnderWay;
}

/** Where the buffer is kept (platform's telemetry store). Either call may throw; telemetry never does. */
export interface TelemetryStorage {
  read(): string | null;
  write(text: string): boolean;
}

export interface Telemetry {
  /** The player arrived (cold start or return). Ignored while a check-in is open. */
  beginCheckIn(arrival: { readonly phase: string; readonly decisionsAvailable: number }): void;
  /** The page hid. Ignored when no check-in is open. */
  endCheckIn(): void;
  /** The game is now in `phase`; a different phase closes the one under way. */
  phase(phase: string): void;
  snapshot(): TelemetrySnapshot;
  /** The export file's text: the entries, the open check-in so far and time per phase. */
  exportText(meta: { readonly build: string }): string;
}

export interface NormalizedTelemetry {
  readonly entries: TelemetryEntry[];
  readonly current: PhaseUnderWay | null;
  readonly lastSeenAt: number | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function entryOf(v: unknown): TelemetryEntry | null {
  if (!isRecord(v) || !isTime(v.atMs) || typeof v.phase !== 'string') return null;
  if (v.kind === 'check_in') {
    if (!(v.awayMs === null || isTime(v.awayMs)) || !isTime(v.lengthMs) || !isCount(v.decisionsAvailable)) return null;
    return { kind: 'check_in', atMs: v.atMs, awayMs: v.awayMs, lengthMs: v.lengthMs, phase: v.phase, decisionsAvailable: v.decisionsAvailable };
  }
  if (v.kind === 'phase') {
    if (typeof v.next !== 'string' || !isTime(v.activeMs) || !isTime(v.elapsedMs)) return null;
    return { kind: 'phase', atMs: v.atMs, phase: v.phase, next: v.next, activeMs: v.activeMs, elapsedMs: v.elapsedMs };
  }
  return null;
}

function currentOf(v: unknown): PhaseUnderWay | null {
  if (!isRecord(v) || typeof v.phase !== 'string' || !isTime(v.enteredAtMs) || !isTime(v.activeMs)) return null;
  return { phase: v.phase, enteredAtMs: v.enteredAtMs, activeMs: v.activeMs };
}

/** Stored telemetry, checked: anything foreign or from another version reads as empty; bad entries drop. */
export function normalizeTelemetry(raw: unknown): NormalizedTelemetry {
  const empty: NormalizedTelemetry = { entries: [], current: null, lastSeenAt: null };
  if (!isRecord(raw) || raw.format !== TELEMETRY_FORMAT || raw.version !== TELEMETRY_VERSION || !Array.isArray(raw.entries)) return empty;
  const entries = raw.entries.map(entryOf).filter((e): e is TelemetryEntry => e !== null);
  return {
    entries: entries.slice(-TELEMETRY_MAX_ENTRIES),
    current: currentOf(raw.current),
    lastSeenAt: isTime(raw.lastSeenAt) ? raw.lastSeenAt : null,
  };
}

function load(storage: TelemetryStorage): NormalizedTelemetry {
  try {
    const text = storage.read();
    return normalizeTelemetry(text === null ? null : JSON.parse(text));
  } catch {
    return { entries: [], current: null, lastSeenAt: null };
  }
}

const span = (from: number, to: number): number => Math.max(0, Math.floor(to - from));

export function createTelemetry(deps: { storage: TelemetryStorage; now: () => number; phase: string }): Telemetry {
  const { storage, now } = deps;
  const loaded = load(storage);
  const entries: TelemetryEntry[] = loaded.entries;
  let lastSeenAt = loaded.lastSeenAt;
  let current: PhaseUnderWay = loaded.current ?? { phase: deps.phase, enteredAtMs: now(), activeMs: 0 };
  let open: { atMs: number; awayMs: number | null; phase: string; decisionsAvailable: number } | null = null;
  /** Where the open check-in's time stops counting toward the previous phase. */
  let segmentStart = 0;

  const persist = (): void => {
    try {
      storage.write(JSON.stringify({ format: TELEMETRY_FORMAT, version: TELEMETRY_VERSION, entries, current, lastSeenAt }));
    } catch {
      // Storage is blocked or full: the buffer lasts the session.
    }
  };

  const push = (entry: TelemetryEntry): void => {
    entries.push(entry);
    if (entries.length > TELEMETRY_MAX_ENTRIES) entries.splice(0, entries.length - TELEMETRY_MAX_ENTRIES);
  };

  /** Moves the open check-in's time so far onto the phase under way. */
  const settle = (t: number): void => {
    if (!open) return;
    current = { ...current, activeMs: current.activeMs + span(segmentStart, t) };
    segmentStart = t;
  };

  const telemetry: Telemetry = {
    beginCheckIn(arrival) {
      if (open) return;
      telemetry.phase(arrival.phase);
      const t = now();
      open = {
        atMs: t,
        awayMs: lastSeenAt === null ? null : span(lastSeenAt, t),
        phase: arrival.phase,
        decisionsAvailable: Math.max(0, Math.floor(arrival.decisionsAvailable)),
      };
      segmentStart = t;
    },
    endCheckIn() {
      if (!open) return;
      const t = now();
      settle(t);
      push({ kind: 'check_in', ...open, lengthMs: span(open.atMs, t) });
      open = null;
      lastSeenAt = t;
      persist();
    },
    phase(phase) {
      if (phase === current.phase) return;
      const t = now();
      settle(t);
      push({ kind: 'phase', atMs: t, phase: current.phase, next: phase, activeMs: current.activeMs, elapsedMs: span(current.enteredAtMs, t) });
      current = { phase, enteredAtMs: t, activeMs: 0 };
      persist();
    },
    snapshot() {
      return { entries: [...entries], current: { ...current } };
    },
    exportText({ build }) {
      const t = now();
      const live: PhaseUnderWay = { ...current, activeMs: current.activeMs + (open ? span(segmentStart, t) : 0) };
      const phaseActiveMs: Record<string, number> = {};
      for (const e of entries) if (e.kind === 'phase') phaseActiveMs[e.phase] = (phaseActiveMs[e.phase] ?? 0) + e.activeMs;
      phaseActiveMs[live.phase] = (phaseActiveMs[live.phase] ?? 0) + live.activeMs;
      return JSON.stringify(
        {
          format: TELEMETRY_FORMAT,
          version: TELEMETRY_VERSION,
          build,
          exportedAt: t,
          maxEntries: TELEMETRY_MAX_ENTRIES,
          phaseActiveMs,
          current: live,
          openCheckIn: open ? { kind: 'check_in', ...open, lengthMs: span(open.atMs, t) } : null,
          entries,
        },
        null,
        2,
      );
    },
  };

  // A save in another phase than the stored one (a prestige or an import while away) closes that phase.
  telemetry.phase(deps.phase);
  return telemetry;
}
