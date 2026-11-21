import { describe, expect, it } from 'vitest';
import { buildDiagnostics, DIAGNOSTICS_FILENAME } from '../../../src/debug/diagnostics';
import type { LogEntry } from '../../../src/utils/log';

/**
 * Story 1.27 (UX-DR32, architecture → Logging): settings → EXPORT DIAGNOSTICS
 * gives a file with the log ring buffer, the state (as the save serializes it),
 * the settings, the device capabilities and the build. It never leaves the device.
 */

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  level: 'error',
  scope: 'tick',
  message: 'tick failed',
  detail: [],
  time: 1,
  ...over,
});

const base = {
  build: 'abc1234',
  now: 1_700_000_000_000,
  userAgent: 'test-agent',
  save: JSON.stringify({ version: 16, gameState: { phase: 'EGG_LAYING' } }),
  settings: { sound: false },
  capabilities: { vibrate: false },
};

describe('diagnostics export', () => {
  it('is JSON holding the log, the save, the settings, the capabilities and the build', () => {
    const logs = [entry(), entry({ level: 'warn', scope: 'save', message: 'backup loaded' })];
    const parsed = JSON.parse(buildDiagnostics({ ...base, log: logs }));
    expect(parsed.build).toBe(base.build);
    expect(parsed.save).toEqual(JSON.parse(base.save));
    expect(parsed.settings).toEqual(base.settings);
    expect(parsed.capabilities).toEqual(base.capabilities);
    expect(parsed.log).toHaveLength(logs.length);
    expect(parsed.log.map((l: LogEntry) => l.message)).toEqual(logs.map((l) => l.message));
  });

  it('says what the persistent-storage request came to (Story 2.12)', () => {
    expect(JSON.parse(buildDiagnostics({ ...base, storage: 'granted', log: [] })).storage).toBe('granted');
    expect(JSON.parse(buildDiagnostics({ ...base, log: [] })).storage).toBeNull();
  });

  it('names the seed the state ran with (Story 1.34)', () => {
    const parsed = JSON.parse(buildDiagnostics({ ...base, seed: 4242, log: [] }));
    expect(parsed.seed).toBe(4242);
    expect(JSON.parse(buildDiagnostics({ ...base, log: [] })).seed).toBeNull();
  });

  it('keeps the message of an Error in a log detail', () => {
    const parsed = JSON.parse(buildDiagnostics({ ...base, log: [entry({ detail: [new Error('boom')] })] }));
    expect(JSON.stringify(parsed.log[0].detail)).toContain('boom');
  });

  it('survives a detail that cannot be serialized', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    const text = buildDiagnostics({ ...base, log: [entry({ detail: [loop, 10n] })] });
    expect(() => JSON.parse(text)).not.toThrow();
    expect(JSON.parse(text).log).toHaveLength(1);
  });

  it('keeps an unreadable save as text instead of failing', () => {
    const parsed = JSON.parse(buildDiagnostics({ ...base, save: '{broken', log: [] }));
    expect(parsed.save).toBe('{broken');
  });

  it('carries the save that could not be read, as it was (Story 2.2)', () => {
    const damaged = '{"version": 19, "gameState": {';
    const out = JSON.parse(buildDiagnostics({ ...base, log: [], unreadableSave: damaged }));
    expect(out.unreadableSave).toBe(damaged);
    expect(JSON.parse(buildDiagnostics({ ...base, log: [] })).unreadableSave).toBeNull();
  });

  it('names a .json file', () => {
    expect(DIAGNOSTICS_FILENAME.endsWith('.json')).toBe(true);
  });
});
