import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { gameState } from '../../../../src/state/gameSignal';
import { createInitialState, type GameState } from '../../../../src/state/GameState';
import { Phase, PHASE_ORDER } from '../../../../src/phases/phases';
import { selectEffectiveNestCapacity } from '../../../../src/state/selectors';
import { RESOURCES, STRIP_SETS, type ResourceId } from '../../../../src/ui/shell/resourceCatalog';
import {
  createResourceFeed,
  stripCells,
  REFRESH_MS,
  STRIP_CELLS,
  type ResourceSnapshot,
} from '../../../../src/ui/shell/resourceFeed';

/**
 * Story 1.16 (UX-DR7/8): the resource feed samples the state at most 4 times a
 * second and gives the strip and the resource sheet one snapshot: every
 * resource with its amount, whole-number rate per second (from game time),
 * cap and unlock status.
 */

type Patch = (s: GameState) => GameState;
const write = (patch: Patch) => {
  gameState.value = patch(gameState.value);
};
const at = (phase: Phase): Patch => (s) => ({ ...s, phase });
const advance =
  (ms: number, res: Partial<GameState['resources']> = {}): Patch =>
  (s) => ({
    ...s,
    resources: { ...s.resources, ...res },
    stats: { ...s.stats, playTimeMs: s.stats.playTimeMs + ms },
  });
const row = (snap: ResourceSnapshot, id: ResourceId) => snap.rows.find((r) => r.id === id)!;

beforeEach(() => {
  gameState.value = createInitialState();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('resource catalog', () => {
  it('has one entry per resource, each with a label of at most 4 letters, a full name and a source', () => {
    const ids = RESOURCES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RESOURCES) {
      expect(r.label).toMatch(/^[A-Z]{1,4}$/);
      expect(r.name.length).toBeGreaterThan(r.label.length - 1);
      expect(r.source.trim()).not.toBe('');
      expect(r.glyph.trim()).not.toBe('');
    }
  });

  it('uses the spec strip sets for Phase 1 and Phase 2, and never more than 5 cells', () => {
    expect(STRIP_SETS[Phase.EGG_LAYING]).toEqual(['eggs', 'larvae', 'workers', 'food']);
    expect(STRIP_SETS[Phase.COLONY]).toEqual(['food', 'workers', 'wood', 'stone', 'nectar']);
    for (const p of PHASE_ORDER) expect(STRIP_SETS[p].length).toBeLessThanOrEqual(STRIP_CELLS);
  });

  it("unlocks every resource of a phase's strip set by that phase", () => {
    for (const p of PHASE_ORDER) {
      gameState.value = { ...createInitialState(), phase: p };
      const snap = createResourceFeed().snapshot.value;
      for (const id of STRIP_SETS[p]) expect(row(snap, id).unlocked).toBe(true);
    }
  });
});

describe('createResourceFeed', () => {
  it('in Phase 1 unlocks only the Phase 1 resources (when the others are empty)', () => {
    const snap = createResourceFeed().snapshot.value;
    const unlocked = snap.rows.filter((r) => r.unlocked).map((r) => r.id);
    expect(new Set(unlocked)).toEqual(new Set(STRIP_SETS[Phase.EGG_LAYING]));
  });

  it('unlocks a resource early once the colony holds some of it', () => {
    write(advance(0, { voidCrystals: 3 }));
    expect(row(createResourceFeed().snapshot.value, 'voidCrystals').unlocked).toBe(true);
  });

  it('reports a later phase as unlocking more resources, never fewer', () => {
    let prev = 0;
    for (const p of PHASE_ORDER) {
      gameState.value = { ...createInitialState(), phase: p };
      const n = createResourceFeed().snapshot.value.rows.filter((r) => r.unlocked).length;
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });

  it('shows amounts as integers', () => {
    write(advance(0, { food: 12.7 }));
    expect(Number.isInteger(row(createResourceFeed().snapshot.value, 'food').amount)).toBe(true);
  });

  it('measures a whole-number rate per second over game time: rising positive, falling negative', () => {
    write(at(Phase.COLONY));
    write(advance(0, { food: 100, wood: 0 }));
    const feed = createResourceFeed();
    write(advance(2000, { food: 90, wood: 7 }));
    feed.sample();
    const snap = feed.snapshot.value;
    expect(row(snap, 'food').rate).toBeLessThan(0);
    expect(row(snap, 'wood').rate).toBeGreaterThan(0);
    for (const r of snap.rows) expect(Number.isInteger(r.rate)).toBe(true);
  });

  it('reports a zero rate when nothing changed or no game time passed', () => {
    const feed = createResourceFeed();
    write(advance(0, { eggs: 50 }));
    feed.sample();
    expect(row(feed.snapshot.value, 'eggs').rate).toBe(0);
    write(advance(1000));
    feed.sample();
    feed.sample();
    expect(row(feed.snapshot.value, 'food').rate).toBe(0);
  });

  it('starts over when game time runs backwards (a new run or a loaded save)', () => {
    write(advance(10_000, { food: 1000 }));
    const feed = createResourceFeed();
    gameState.value = createInitialState(); // playTimeMs back to the start, food back to its start
    feed.sample();
    expect(row(feed.snapshot.value, 'food').rate).toBe(0);
  });

  it('marks workers capped at the effective nest capacity, and nothing without a cap', () => {
    const cap = selectEffectiveNestCapacity.value;
    write(advance(0, { workers: cap }));
    const snap = createResourceFeed().snapshot.value;
    expect(row(snap, 'workers').cap).toBe(cap);
    expect(row(snap, 'workers').capped).toBe(true);
    for (const r of snap.rows.filter((x) => x.cap === null)) expect(r.capped).toBe(false);
    write(advance(0, { workers: Math.max(0, cap - 1) }));
    expect(row(createResourceFeed().snapshot.value, 'workers').capped).toBe(false);
  });

  it('refreshes at most 4 times a second while retained, and stops when released', () => {
    vi.useFakeTimers();
    expect(REFRESH_MS).toBeGreaterThanOrEqual(250);
    const feed = createResourceFeed();
    const release = feed.retain();
    const releaseAgain = feed.retain(); // a second reader shares the same timer
    let updates = 0;
    const stop = feed.snapshot.subscribe(() => updates++);
    updates = 0;
    for (let i = 0; i < 20; i++) {
      write(advance(50, { eggs: i + 1 }));
      vi.advanceTimersByTime(50);
    }
    // 1 000 ms of 20 Hz writes
    expect(updates).toBeLessThanOrEqual(4);
    expect(row(feed.snapshot.value, 'eggs').amount).toBeGreaterThan(0);
    release();
    releaseAgain();
    updates = 0;
    write(advance(50, { eggs: 999 }));
    vi.advanceTimersByTime(REFRESH_MS * 4);
    expect(updates).toBe(0);
    stop();
  });
});

describe('stripCells', () => {
  function snapshotAt(phase: Phase, patch: Patch = (s) => s): ResourceSnapshot {
    gameState.value = patch({ ...createInitialState(), phase });
    return createResourceFeed().snapshot.value;
  }

  it('shows the phase set in Phase 1 and Phase 2', () => {
    expect(stripCells(snapshotAt(Phase.EGG_LAYING))).toEqual(STRIP_SETS[Phase.EGG_LAYING]);
    expect(stripCells(snapshotAt(Phase.COLONY))).toEqual(STRIP_SETS[Phase.COLONY]);
  });

  it('from Phase 3 puts capped or falling resources first', () => {
    write(at(Phase.COMBAT));
    write(advance(0, { nectar: 50 }));
    const feed = createResourceFeed();
    write(advance(1000, { nectar: 40 }));
    feed.sample();
    const snap = feed.snapshot.value;
    expect(STRIP_SETS[Phase.COMBAT]).not.toContain('nectar');
    const cells = stripCells(snap);
    expect(cells[0]).toBe('nectar');
    expect(cells.length).toBeLessThanOrEqual(STRIP_CELLS);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('never lists a locked resource', () => {
    for (const p of PHASE_ORDER) {
      const snap = snapshotAt(p);
      for (const id of stripCells(snap)) expect(row(snap, id).unlocked).toBe(true);
    }
  });

  it('with fewer cells, puts capped or falling resources first in every phase', () => {
    const cap = selectEffectiveNestCapacity.value;
    const snap = snapshotAt(Phase.EGG_LAYING, (s) => ({ ...s, resources: { ...s.resources, workers: cap } }));
    const cells = stripCells(snap, 3);
    expect(cells).toHaveLength(3);
    expect(cells[0]).toBe('workers');
  });
});
