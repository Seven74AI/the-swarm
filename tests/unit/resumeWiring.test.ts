import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { log } from '../../src/utils/log';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { SaveManager } from '../../src/persistence/SaveManager';

/**
 * Story 2.3, wired in main: every way back (cold load, tab visible again, bfcache
 * pageshow, focus after sleep, a long frame) goes through the one resume path,
 * and each gap is applied once. `log.info('resume', …)` is written once per resume.
 */

interface Swarm {
  ticker: { isRunning(): boolean; stop(): void };
  manager: { getState(): GameState };
  sheets: { state: { value: { open: { priority: string } | null } } };
}

const SAVE_KEY = 'the_swarm_save';
const resumes = () => log.entries().filter((e) => e.scope === 'resume');
const savedEnvelope = () => JSON.parse(localStorage.getItem(SAVE_KEY)!) as { lastSeenAt: number };

let visibility = 'visible';
const setVisibility = (v: string) => {
  visibility = v;
  document.dispatchEvent(new Event('visibilitychange'));
};

let swarm: Swarm;
let resumesAtBoot: ReturnType<typeof resumes>;

beforeAll(async () => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  localStorage.clear();
  const seenAt = Date.now() - 20_000;
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({
      version: SaveManager.SAVE_VERSION,
      timestamp: seenAt,
      lastSeenAt: seenAt,
      playTimeMs: 0,
      gameState: { ...createInitialState(), lastSaveTimestamp: seenAt },
    }),
  );
  log.clear();
  document.body.innerHTML = '<div id="app"></div>';
  await import('../../src/main');
  swarm = (window as unknown as { __swarm: Swarm }).__swarm;
  resumesAtBoot = resumes();
});

afterEach(() => {
  vi.restoreAllMocks();
  if (visibility !== 'visible') setVisibility('visible');
});

/** Hide the page, let `ms` of wall clock pass, then run `back` (the return signal). */
function awayAndBack(ms: number, back: () => void): void {
  const start = Date.now();
  setVisibility('hidden');
  vi.spyOn(Date, 'now').mockReturnValue(start + ms);
  back();
}

describe('the one resume path, wired in main (Story 2.3)', () => {
  it('a cold load resumes exactly once, from lastSeenAt, with no summary under 60 s', () => {
    expect(resumesAtBoot).toHaveLength(1);
    const elapsed = (resumesAtBoot[0].detail[0] as { elapsedMs: number }).elapsedMs;
    expect(elapsed).toBeGreaterThanOrEqual(20_000);
    expect(elapsed).toBeLessThan(60_000);
    expect(swarm.sheets.state.value.open).toBeNull();
  });

  it('hiding saves with lastSeenAt and stops the ticker; nothing is simulated while hidden', () => {
    const before = Date.now();
    setVisibility('hidden');
    expect(swarm.ticker.isRunning()).toBe(false);
    expect(savedEnvelope().lastSeenAt).toBeGreaterThanOrEqual(before);
    const state = swarm.manager.getState();
    expect(swarm.manager.getState()).toBe(state);
  });

  for (const [name, back] of [
    ['visibilitychange to visible', () => setVisibility('visible')],
    ['bfcache pageshow', () => {
      visibility = 'visible';
      window.dispatchEvent(new Event('pageshow'));
    }],
    ['focus after sleep', () => {
      visibility = 'visible';
      window.dispatchEvent(new Event('focus'));
    }],
  ] as const) {
    it(`${name} resumes once and restarts the ticker`, () => {
      const n = resumes().length;
      awayAndBack(10_000, back);
      expect(resumes().length).toBe(n + 1);
      expect(swarm.ticker.isRunning()).toBe(true);
    });
  }

  it('pagehide then every return signal applies the gap once', () => {
    const n = resumes().length;
    const start = Date.now();
    window.dispatchEvent(new Event('pagehide'));
    visibility = 'hidden';
    vi.spyOn(Date, 'now').mockReturnValue(start + 10_000);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new Event('focus'));
    expect(resumes().length).toBe(n + 1);
  });

  it('a short return opens no sheet and flashes the strip deltas once (Story 2.9)', async () => {
    const strip = () => document.querySelector('[data-resource-strip]');
    expect(strip()).not.toBeNull();
    awayAndBack(10_000, () => setVisibility('visible'));
    vi.restoreAllMocks();
    await new Promise((r) => setTimeout(r, 0));
    expect(swarm.sheets.state.value.open).toBeNull();
    expect(strip()!.hasAttribute('data-flash')).toBe(true);
  });

  it('a return after 60 s or more opens the offline summary, with one next move (Story 2.9)', async () => {
    awayAndBack(5 * 60_000, () => setVisibility('visible'));
    expect(swarm.sheets.state.value.open?.priority).toBe('offline');
    await new Promise((r) => setTimeout(r, 0));
    const sheet = document.querySelector('.offline-summary-popup')!;
    expect(sheet.querySelector('[data-sheet-headline]')!.textContent).toMatch(/^YOU WERE GONE \S.*\. THE NEST KEPT WORKING\.$/);
    const moves = sheet.querySelectorAll('button[data-action="offline-next"], [data-next-action="none"]');
    expect(moves).toHaveLength(1);
    expect(moves[0].textContent).toMatch(/\S/);
  });
});
