/**
 * Story 9.3 (FR56, UX-DR47): how close the next room is. Invariants only;
 * numbers come from the dig helpers.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { nextRoom, pressChunk, roomCost } from '../../../src/systems/Dig';
import { digBalance } from '../../../src/data/balance/dig';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { EventBus } from '../../../src/engine/EventBus';
import { MS_PER_SEC } from '../../../src/data/constants';
import { Phase } from '../../../src/phases/phases';
import { makeState } from '../helpers/makeState';
import { gameState } from '../../../src/state/gameSignal';
import { selectNextRoom } from '../../../src/state/selectors';
import type { GameState } from '../../../src/state/GameState';

const colony = (dig: number, progress = 0) =>
  makeState({ phase: Phase.COLONY, resources: { workers: Math.max(dig, 1) }, workersAssigned: { dig }, dig: { roomsDug: 2, progress, carry: 0 } });

describe('nextRoom', () => {
  it('names the next room size, its whole share done and the presses left', () => {
    const cost = roomCost(2);
    for (const progress of [0, 1, Math.floor(cost / 2), cost - 1]) {
      const s = colony(3, progress);
      const r = nextRoom(s);
      expect(r.size).toBe(digBalance.roomSize);
      expect(Number.isInteger(r.percent)).toBe(true);
      expect(r.percent).toBeGreaterThanOrEqual(0);
      expect(r.percent).toBeLessThan(100);
      expect(r.presses).toBe(Math.ceil((cost - progress) / pressChunk(s)));
      expect(r.presses).toBeGreaterThanOrEqual(1);
    }
    expect(nextRoom(colony(3, cost - 1)).percent).toBeGreaterThan(nextRoom(colony(3, 0)).percent);
  });

  it('has no time without diggers', () => {
    expect(nextRoom(colony(0)).timeLeftMs).toBeNull();
    expect(nextRoom(colony(2)).timeLeftMs).toBeGreaterThan(0);
  });

  it('more diggers: never more presses, and less time', () => {
    const few = nextRoom(colony(2));
    const many = nextRoom(colony(40));
    expect(many.presses).toBeLessThanOrEqual(few.presses);
    expect(many.timeLeftMs!).toBeLessThan(few.timeLeftMs!);
  });

  it('its time matches the time the dig system takes to open the room, within one step', () => {
    const system = new ResourceSystem(new EventBus());
    const stepSec = 60;
    for (const [diggers, progress] of [[5, 0], [12, Math.floor(roomCost(2) * 0.9)]] as const) {
      let s: GameState = colony(diggers, progress);
      const predicted = nextRoom(s).timeLeftMs!;
      let elapsed = 0;
      while (s.dig.roomsDug === 2) {
        s = system.tick(s, undefined, stepSec);
        elapsed += stepSec * MS_PER_SEC;
      }
      expect(Math.abs(elapsed - predicted)).toBeLessThanOrEqual(stepSec * MS_PER_SEC);
    }
  });
});

describe('selectNextRoom', () => {
  const initial = gameState.value;
  afterEach(() => {
    gameState.value = initial;
  });

  it('is null in Egg Laying and the next room from Colony on', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING });
    expect(selectNextRoom.value).toBeNull();
    gameState.value = colony(3, 10);
    expect(selectNextRoom.value).toEqual(nextRoom(gameState.value));
  });

  it('keeps its value when a write changes nothing it shows', () => {
    gameState.value = colony(3, 10);
    const a = selectNextRoom.value;
    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, food: gameState.value.resources.food + 1 } };
    expect(selectNextRoom.value).toBe(a);
  });
});

describe('the dig-face crack (Story 9.3)', () => {
  it('grows in a few visible stages with the progress, never shrinking until the room opens', async () => {
    const { crackStage, CRACK_STAGES } = await import('../../../src/ui/scenes/nestLayout');
    expect(CRACK_STAGES).toBeGreaterThan(1);
    expect(crackStage(0)).toBe(0);
    let last = 0;
    for (let p = 0; p < 100; p++) {
      const stage = crackStage(p);
      expect(Number.isInteger(stage)).toBe(true);
      expect(stage).toBeGreaterThanOrEqual(last);
      expect(stage).toBeLessThanOrEqual(CRACK_STAGES);
      last = stage;
    }
    expect(last).toBe(CRACK_STAGES);
  });
});
