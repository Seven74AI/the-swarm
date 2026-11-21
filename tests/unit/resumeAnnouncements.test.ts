import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { SaveManager } from '../../src/persistence/SaveManager';

/**
 * Story 2.3 regression: the cold-load resume runs after the UI's listeners are
 * bound, so a goal its catch-up latches is announced like any other (Story 1.32
 * announces each state once, when it starts).
 */

interface Swarm {
  loop: { stop(): void };
  manager: { getState(): GameState };
}

let swarm: Swarm;

beforeAll(async () => {
  localStorage.clear();
  const seenAt = Date.now() - 3_000;
  const base = createInitialState();
  const gameState: GameState = {
    ...base,
    phase: 'egg_laying',
    resources: { ...base.resources, workers: 1_000, food: 10_000_000, nestCapacity: 2_000 },
    lastSaveTimestamp: seenAt,
  };
  localStorage.setItem(
    'the_swarm_save',
    JSON.stringify({ version: SaveManager.SAVE_VERSION, timestamp: seenAt, lastSeenAt: seenAt, playTimeMs: 0, gameState }),
  );
  document.body.innerHTML = '<div id="app"></div>';
  await import('../../src/main');
  swarm = (window as unknown as { __swarm: Swarm }).__swarm;
  swarm.loop.stop();
});

describe('a goal latched by the cold-load resume (Story 2.3)', () => {
  it('is latched by the resume itself', () => {
    expect(swarm.manager.getState().phaseGoal?.latched).toBe(true);
  });

  it('is announced', async () => {
    await vi.waitFor(() => {
      expect(document.querySelector('[data-announcer]')?.textContent ?? '').toMatch(/goal met/i);
    });
  });
});
