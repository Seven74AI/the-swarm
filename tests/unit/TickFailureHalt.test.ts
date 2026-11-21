import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { MAX_FAILED_TICKS } from '../../src/engine/GameLoop';
import type { GameState } from '../../src/state/GameState';
import { log } from '../../src/utils/log';

/**
 * Story 1.17, wired in main: with a system stubbed to throw, 3 failed ticks stop
 * the simulation and open the EXPORT SAVE / RELOAD sheet, and every save written
 * afterwards is the last good snapshot, never the failing state.
 */

interface Swarm {
  tick(dtSec: number): void;
  loop: { stop(): void; isHalted(): boolean };
  manager: { getState(): GameState };
  platform: { browser: { download(name: string, text: string): void; reload(): void } };
  sheets: { state: { value: { open: { priority: string } | null } } };
}

const SAVE_KEY = 'the_swarm_save';
const saved = (): GameState => JSON.parse(localStorage.getItem(SAVE_KEY)!).gameState as GameState;
/** Compare game content, not the save's own timestamp. */
const content = (s: GameState) => JSON.stringify({ ...s, lastSaveTimestamp: 0 });

let swarm: Swarm;
let lastGood: GameState;

beforeAll(async () => {
  localStorage.clear();
  document.body.innerHTML = '<div id="app"></div>';
  await import('../../src/main');
  swarm = (window as unknown as { __swarm: Swarm }).__swarm;
  swarm.loop.stop();
  swarm.tick(0.05); // one good tick
  lastGood = swarm.manager.getState();
  vi.spyOn(ResourceSystem.prototype, 'tick').mockImplementation(() => {
    throw new Error('stubbed system bug');
  });
  log.clear();
});
afterAll(() => {
  vi.restoreAllMocks();
});

describe('a run with a throwing system (Story 1.17)', () => {
  it('keeps the last good state through failed ticks and logs each failure', () => {
    for (let i = 0; i < MAX_FAILED_TICKS - 1; i++) swarm.tick(0.05);
    expect(swarm.manager.getState()).toBe(lastGood);
    expect(swarm.loop.isHalted()).toBe(false);
    expect(log.entries().filter((e) => e.level === 'error' && e.scope === 'tick').length).toBeGreaterThan(0);
  });

  it('the third failure stops the simulation and opens the EXPORT SAVE / RELOAD sheet', async () => {
    swarm.tick(0.05);
    expect(swarm.loop.isHalted()).toBe(true);
    expect(swarm.manager.getState()).toBe(lastGood);
    expect(swarm.sheets.state.value.open?.priority).toBe('offline');
    // The App re-renders the sheet host on its next render pass.
    const sheet = await vi.waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-tick-failure]');
      if (!el) throw new Error('sheet not drawn yet');
      return el;
    });
    expect(sheet!.querySelector('[data-action="export-save"]')).not.toBeNull();
    expect(sheet!.querySelector('[data-action="reload"]')).not.toBeNull();
  });

  it('the save written at the halt is the last good snapshot', () => {
    expect(content(saved())).toBe(content(lastGood));
  });

  it('the save written on unload is still the last good snapshot', () => {
    localStorage.removeItem(SAVE_KEY);
    window.dispatchEvent(new Event('beforeunload'));
    expect(content(saved())).toBe(content(lastGood));
  });

  it('EXPORT SAVE downloads the last good snapshot; RELOAD reloads the page', () => {
    const download = vi.spyOn(swarm.platform.browser, 'download').mockImplementation(() => {});
    const reload = vi.spyOn(swarm.platform.browser, 'reload').mockImplementation(() => {});
    document.querySelector<HTMLButtonElement>('[data-tick-failure] [data-action="export-save"]')!.click();
    expect(download).toHaveBeenCalledTimes(1);
    const text = download.mock.calls[0][1];
    expect(content(JSON.parse(text).gameState as GameState)).toBe(content(lastGood));
    document.querySelector<HTMLButtonElement>('[data-tick-failure] [data-action="reload"]')!.click();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
