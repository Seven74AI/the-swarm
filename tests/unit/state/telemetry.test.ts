// @vitest-environment node
/**
 * Story 3.10 (FR38, NFR10): play telemetry is a ring buffer kept beside the
 * game, outside the save. It records check-ins (length, time away, decisions
 * available on arrival) and time per phase, never grows past a fixed size, and
 * leaves the device only as a file the player exports.
 */
import { describe, expect, it } from 'vitest';
import {
  createTelemetry,
  normalizeTelemetry,
  TELEMETRY_FORMAT,
  type TelemetryStorage,
} from '../../../src/state/telemetry';
import { TELEMETRY_MAX_ENTRIES } from '../../../src/data/constants';
import { Phase } from '../../../src/phases/phases';
import { SaveManager } from '../../../src/persistence/SaveManager';
import { createLocalSaveStore } from '../../../src/platform/storage/SaveStore';
import { createInitialState } from '../../../src/state/GameState';

function memory(initial: string | null = null): TelemetryStorage & { text: string | null; writes: number } {
  const box = {
    text: initial,
    writes: 0,
    read: () => box.text,
    write: (t: string) => {
      box.text = t;
      box.writes += 1;
      return true;
    },
  };
  return box;
}

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
}

const arrive = (phase: string, decisionsAvailable = 0) => ({ phase, decisionsAvailable });

describe('telemetry ring buffer (Story 3.10)', () => {
  it('records a check-in with its length, the time away before it and the decisions on arrival', () => {
    const c = clock();
    const t = createTelemetry({ storage: memory(), now: c.now, phase: Phase.EGG_LAYING });
    t.beginCheckIn(arrive(Phase.EGG_LAYING, 2));
    c.advance(30_000);
    t.endCheckIn();
    c.advance(600_000);
    t.beginCheckIn(arrive(Phase.EGG_LAYING, 5));
    c.advance(10_000);
    t.endCheckIn();

    const checkIns = t.snapshot().entries.filter((e) => e.kind === 'check_in');
    expect(checkIns).toHaveLength(2);
    const [first, second] = checkIns;
    expect(first.lengthMs).toBeGreaterThan(second.lengthMs);
    expect(first.decisionsAvailable).toBeLessThan(second.decisionsAvailable);
    // The second arrival knows how long the player was away; the first, on a new device, doesn't.
    expect(first.awayMs).toBeNull();
    expect(second.awayMs).toBeGreaterThan(first.lengthMs);
    for (const e of checkIns) {
      expect(Number.isInteger(e.lengthMs)).toBe(true);
      expect(e.lengthMs).toBeGreaterThan(0);
    }
  });

  it('records time per phase: foreground time and wall time in the phase left', () => {
    const c = clock();
    const t = createTelemetry({ storage: memory(), now: c.now, phase: Phase.EGG_LAYING });
    t.beginCheckIn(arrive(Phase.EGG_LAYING));
    c.advance(20_000);
    t.endCheckIn();
    c.advance(3_600_000); // away: wall time, not played time
    t.beginCheckIn(arrive(Phase.EGG_LAYING));
    c.advance(15_000);
    t.phase(Phase.COLONY);
    c.advance(5_000);
    t.endCheckIn();

    const s = t.snapshot();
    const phases = s.entries.filter((e) => e.kind === 'phase');
    expect(phases).toHaveLength(1);
    const left = phases[0];
    expect(left.phase).toBe(Phase.EGG_LAYING);
    expect(left.next).toBe(Phase.COLONY);
    // Played time counts only the check-ins; wall time includes the hour away.
    expect(left.activeMs).toBeGreaterThan(0);
    expect(left.elapsedMs).toBeGreaterThan(left.activeMs);
    // The new phase counts from the commit: only the 5 s after it, so far less than the phase left.
    expect(s.current.phase).toBe(Phase.COLONY);
    expect(s.current.activeMs).toBeGreaterThan(0);
    expect(s.current.activeMs).toBeLessThan(left.activeMs);
  });

  it('the same phase again records nothing; a check-in begun twice or ended twice counts once', () => {
    const c = clock();
    const t = createTelemetry({ storage: memory(), now: c.now, phase: Phase.EGG_LAYING });
    t.phase(Phase.EGG_LAYING);
    t.beginCheckIn(arrive(Phase.EGG_LAYING));
    c.advance(1_000);
    t.beginCheckIn(arrive(Phase.EGG_LAYING)); // visible + pageshow + focus
    c.advance(1_000);
    t.endCheckIn();
    t.endCheckIn(); // visibilitychange + pagehide
    expect(t.snapshot().entries).toHaveLength(1);
  });

  it('never holds more than its fixed maximum: the oldest entries drop first', () => {
    const c = clock();
    const store = memory();
    const t = createTelemetry({ storage: store, now: c.now, phase: Phase.EGG_LAYING });
    const total = TELEMETRY_MAX_ENTRIES + 25;
    for (let i = 0; i < total; i++) {
      t.beginCheckIn(arrive(Phase.EGG_LAYING, i));
      c.advance(1_000);
      t.endCheckIn();
      c.advance(1_000);
    }
    const entries = t.snapshot().entries;
    expect(entries.length).toBeLessThanOrEqual(TELEMETRY_MAX_ENTRIES);
    // The newest check-in is kept, the first ones are gone.
    const decisions = entries.map((e) => (e.kind === 'check_in' ? e.decisionsAvailable : -1));
    expect(decisions).toContain(total - 1);
    expect(decisions).not.toContain(0);
    // And what is stored is bounded too.
    expect(normalizeTelemetry(JSON.parse(store.text!)).entries.length).toBeLessThanOrEqual(TELEMETRY_MAX_ENTRIES);
  });

  it('is stored after each entry and read back by the next session', () => {
    const c = clock();
    const store = memory();
    const a = createTelemetry({ storage: store, now: c.now, phase: Phase.EGG_LAYING });
    a.beginCheckIn(arrive(Phase.EGG_LAYING));
    c.advance(5_000);
    a.phase(Phase.COLONY);
    c.advance(5_000);
    a.endCheckIn();
    expect(store.writes).toBeGreaterThan(0);

    c.advance(120_000);
    const b = createTelemetry({ storage: store, now: c.now, phase: Phase.COLONY });
    expect(b.snapshot().entries).toEqual(a.snapshot().entries);
    expect(b.snapshot().current.phase).toBe(Phase.COLONY);
    b.beginCheckIn(arrive(Phase.COLONY));
    c.advance(1_000);
    b.endCheckIn();
    const last = b.snapshot().entries.at(-1)!;
    expect(last.kind).toBe('check_in');
    // Time away is measured across sessions, from the last check-in's end.
    expect(last.kind === 'check_in' && last.awayMs).toBeGreaterThan(0);
  });

  it('a phase that differs from the stored one (a prestige, an imported save) starts a new phase record', () => {
    const c = clock();
    const store = memory();
    const a = createTelemetry({ storage: store, now: c.now, phase: Phase.COMBAT });
    a.beginCheckIn(arrive(Phase.COMBAT));
    c.advance(1_000);
    a.endCheckIn();
    const t = createTelemetry({ storage: store, now: c.now, phase: Phase.EGG_LAYING });
    expect(t.snapshot().current.phase).toBe(Phase.EGG_LAYING);
    const left = t.snapshot().entries.at(-1)!;
    expect(left.kind === 'phase' && [left.phase, left.next]).toEqual([Phase.COMBAT, Phase.EGG_LAYING]);
  });

  it('unreadable or foreign stored text starts an empty buffer, and blocked storage never throws', () => {
    for (const text of ['not json', '{"format":"other"}', JSON.stringify({ format: TELEMETRY_FORMAT, version: 999, entries: [1, 2] })]) {
      const t = createTelemetry({ storage: memory(text), now: () => 0, phase: Phase.EGG_LAYING });
      expect(t.snapshot().entries).toEqual([]);
    }
    const blocked: TelemetryStorage = {
      read: () => {
        throw new Error('blocked');
      },
      write: () => {
        throw new Error('blocked');
      },
    };
    const t = createTelemetry({ storage: blocked, now: () => 0, phase: Phase.EGG_LAYING });
    expect(() => {
      t.beginCheckIn(arrive(Phase.EGG_LAYING));
      t.endCheckIn();
    }).not.toThrow();
    expect(t.snapshot().entries).toHaveLength(1);
  });

  it('drops malformed stored entries and keeps the well-formed ones', () => {
    const good = { kind: 'check_in', atMs: 1, awayMs: null, lengthMs: 5, phase: Phase.EGG_LAYING, decisionsAvailable: 1 };
    const data = normalizeTelemetry({
      format: TELEMETRY_FORMAT,
      version: 1,
      entries: [good, { kind: 'check_in', lengthMs: 'x' }, { kind: 'nope' }, null],
    });
    expect(data.entries).toEqual([good]);
  });

  it('exports a self-describing file: the entries, the check-in under way and time per phase', () => {
    const c = clock();
    const t = createTelemetry({ storage: memory(), now: c.now, phase: Phase.EGG_LAYING });
    t.beginCheckIn(arrive(Phase.EGG_LAYING, 1));
    c.advance(4_000);
    t.phase(Phase.COLONY);
    c.advance(2_000);
    const file = JSON.parse(t.exportText({ build: 'test' }));
    expect(file.format).toBe(TELEMETRY_FORMAT);
    expect(file.build).toBe('test');
    expect(file.maxEntries).toBe(TELEMETRY_MAX_ENTRIES);
    expect(file.entries).toEqual(t.snapshot().entries);
    // The open check-in is in the file with its length so far, without being closed.
    expect(file.openCheckIn.lengthMs).toBeGreaterThan(0);
    expect(t.snapshot().entries.some((e) => e.kind === 'check_in')).toBe(false);
    // Time per phase sums every phase record and the phase under way.
    expect(file.phaseActiveMs[Phase.EGG_LAYING]).toBeGreaterThan(0);
    expect(file.phaseActiveMs[Phase.COLONY]).toBeGreaterThan(0);
  });

  it('lives outside the save: a serialized save holds no telemetry', () => {
    const c = clock();
    const t = createTelemetry({ storage: memory(), now: c.now, phase: Phase.EGG_LAYING });
    t.beginCheckIn(arrive(Phase.EGG_LAYING, 3));
    c.advance(1_000);
    t.endCheckIn();
    const kv = new Map<string, string>();
    const store = createLocalSaveStore({
      getItem: (k) => kv.get(k) ?? null,
      setItem: (k, v) => void kv.set(k, v),
      removeItem: (k) => void kv.delete(k),
    });
    const text = new SaveManager(store).serialize(createInitialState(), 0);
    expect(text).not.toMatch(/telemetry|check_in|decisionsAvailable/i);
  });
});
