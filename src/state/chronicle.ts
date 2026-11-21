import { computed, signal, type ReadonlySignal } from '@preact/signals-core';
import { placementOf, type PanelId } from '../data/content/tabs';

/**
 * The chronicle (Story 1.26, UX-DR30, ADR 0018): the colony's event lines,
 * newest first, kept with the save (last `CHRONICLE_MAX_LINES`).
 *
 * Event lines are narrative written from events (`ui/panels/EventLog`), and
 * no listener may write the game state (AR18). So the chronicle lives beside
 * the game state, not in it: its own signal, saved in the save envelope
 * (`SaveData.chronicle`, arch D4 "inside the save: … the event log"). A
 * prestige starts a new chronicle, like every other part of a run.
 */

/** Lines kept, in memory and in the save. */
export const CHRONICLE_MAX_LINES = 100;

export interface ChronicleEntry {
  readonly message: string;
  /** Wall-clock ms when the line was written. */
  readonly timestamp: number;
  /** The panel the line points at: tapping the line jumps there. */
  readonly target?: PanelId;
}

/** What the save holds. */
export interface ChronicleSave {
  readonly entries: readonly ChronicleEntry[];
  /** One-time lines already written this run (`first_egg`, …), so a reload never repeats them. */
  readonly milestones: readonly string[];
}

export interface AddLineOptions {
  /** Where to insert, 0 = newest (default). */
  at?: number;
  target?: PanelId;
}

export interface Chronicle {
  /** Lines, newest first. */
  readonly entries: ReadonlySignal<readonly ChronicleEntry[]>;
  add(message: string, options?: AddLineOptions): void;
  hasMilestone(id: string): boolean;
  markMilestone(id: string): void;
  /** Replace everything with a saved chronicle. */
  load(save: ChronicleSave): void;
  /** Start over (a new run). */
  reset(): void;
  /** A plain copy for the save. */
  snapshot(): ChronicleSave;
}

export function emptyChronicle(): ChronicleSave {
  return { entries: [], milestones: [] };
}

const isTarget = (t: unknown): t is PanelId => typeof t === 'string' && placementOf(t) !== undefined;

/** Read a saved chronicle defensively: anything malformed is dropped, never thrown. */
export function normalizeChronicle(raw: unknown): ChronicleSave {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return emptyChronicle();
  const r = raw as { entries?: unknown; milestones?: unknown };
  if (!Array.isArray(r.entries)) return emptyChronicle();
  const entries: ChronicleEntry[] = [];
  for (const e of r.entries) {
    if (entries.length >= CHRONICLE_MAX_LINES) break;
    if (e === null || typeof e !== 'object') continue;
    const { message, timestamp, target } = e as Record<string, unknown>;
    if (typeof message !== 'string') continue;
    const at = typeof timestamp === 'number' && Number.isFinite(timestamp) ? Math.floor(timestamp) : 0;
    entries.push(isTarget(target) ? { message, timestamp: at, target } : { message, timestamp: at });
  }
  const milestones = Array.isArray(r.milestones)
    ? [...new Set(r.milestones.filter((m): m is string => typeof m === 'string'))]
    : [];
  return { entries, milestones };
}

export function createChronicle(initial?: ChronicleSave): Chronicle {
  const start = normalizeChronicle(initial ?? emptyChronicle());
  const state = signal<ChronicleSave>(start);
  const entries = computed(() => state.value.entries);
  return {
    entries,
    add(message, options = {}) {
      const cur = state.peek();
      const at = Math.max(0, Math.min(options.at ?? 0, cur.entries.length));
      const entry: ChronicleEntry = options.target
        ? { message, timestamp: Date.now(), target: options.target }
        : { message, timestamp: Date.now() };
      const next = [...cur.entries.slice(0, at), entry, ...cur.entries.slice(at)].slice(0, CHRONICLE_MAX_LINES);
      state.value = { ...cur, entries: next };
    },
    hasMilestone(id) {
      return state.peek().milestones.includes(id);
    },
    markMilestone(id) {
      const cur = state.peek();
      if (cur.milestones.includes(id)) return;
      state.value = { ...cur, milestones: [...cur.milestones, id] };
    },
    load(save) {
      state.value = normalizeChronicle(save);
    },
    reset() {
      state.value = emptyChronicle();
    },
    snapshot() {
      const cur = state.peek();
      return { entries: cur.entries.map((e) => ({ ...e })), milestones: [...cur.milestones] };
    },
  };
}
