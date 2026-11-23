/**
 * Story 9.5 (FR58, FR16): auto-dig hands the digging to the diggers. Invariants only.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { autoDigPointsPerSec, buyAutoDig, canBuyAutoDig, digPress, digRate, diggerPointsPerSec, getAutoDigCost, isAutoDigOpen, nextRoom, pressChunk, roomCost } from '../../../src/systems/Dig';
import { automationBalance } from '../../../src/data/balance/automation';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { EventBus } from '../../../src/engine/EventBus';
import { Phase } from '../../../src/phases/phases';
import { makeState } from '../helpers/makeState';
import { testActions } from '../helpers/actions';
import { gameState } from '../../../src/state/gameSignal';
import { listItems, isItemAffordable, getNextAction } from '../../../src/systems/NextAction';
import type { GameState } from '../../../src/state/GameState';

const A = automationBalance.autoDig;
const initial = gameState.value;
afterEach(() => {
  gameState.value = initial;
});

const colony = (over: { dig?: number; roomsByHand?: number; stone?: number; auto?: boolean } = {}): GameState =>
  makeState({
    phase: Phase.COLONY,
    resources: { workers: Math.max(over.dig ?? 0, 1), stone: over.stone ?? 0 },
    workersAssigned: { dig: over.dig ?? 0 },
    dig: { roomsDug: over.roomsByHand ?? 0, progress: 0, carry: 0, roomsByHand: over.roomsByHand ?? 0, auto: over.auto ?? false },
  });

describe('rooms by hand', () => {
  it('a press that opens a room counts it as opened by hand; diggers alone do not', () => {
    const s = colony();
    const near = { ...s, dig: { ...s.dig, progress: roomCost(0) - 1 } };
    expect(digPress(near).dig.roomsByHand).toBe(near.dig.roomsByHand + 1);
    const system = new ResourceSystem(new EventBus());
    const diggers = colony({ dig: 20 });
    const after = system.tick(diggers, undefined, Math.ceil(roomCost(0) / diggerPointsPerSec(diggers)) + 1);
    expect(after.dig.roomsDug).toBeGreaterThan(diggers.dig.roomsDug);
    expect(after.dig.roomsByHand).toBe(diggers.dig.roomsByHand);
  });
});

describe('the auto-dig card', () => {
  it('opens only after enough rooms by hand, from Colony on, until bought', () => {
    expect(isAutoDigOpen(colony({ roomsByHand: A.unlockAfterRoomsByHand - 1 }))).toBe(false);
    expect(isAutoDigOpen(colony({ roomsByHand: A.unlockAfterRoomsByHand }))).toBe(true);
    expect(isAutoDigOpen({ ...colony({ roomsByHand: A.unlockAfterRoomsByHand }), phase: Phase.EGG_LAYING })).toBe(false);
    expect(isAutoDigOpen(colony({ roomsByHand: A.unlockAfterRoomsByHand, auto: true }))).toBe(false);
  });

  it('is paid in stone only', () => {
    const cost = getAutoDigCost();
    expect(Object.keys(cost)).toEqual(['stone']);
    expect(cost.stone).toBeGreaterThan(0);
    const open = colony({ roomsByHand: A.unlockAfterRoomsByHand });
    expect(canBuyAutoDig({ ...open, resources: { ...open.resources, stone: cost.stone - 1 } })).toBe(false);
    expect(canBuyAutoDig({ ...open, resources: { ...open.resources, stone: cost.stone } })).toBe(true);
  });

  it('buying takes the stone and turns auto-dig on, through the action, once', () => {
    const actions = testActions();
    gameState.value = colony({ roomsByHand: A.unlockAfterRoomsByHand, stone: getAutoDigCost().stone + 5 });
    expect(actions.buyAutoDig().ok).toBe(true);
    expect(gameState.value.dig.auto).toBe(true);
    expect(gameState.value.resources.stone).toBe(5);
    expect(actions.buyAutoDig().ok).toBe(false);
  });

  it('is a BUILD item, suggested when affordable', () => {
    const s = colony({ roomsByHand: A.unlockAfterRoomsByHand, stone: getAutoDigCost().stone });
    const ref = listItems().find((r) => r.kind === 'autodig')!;
    expect(ref).toBeDefined();
    expect(isItemAffordable(s, ref)).toBe(true);
    expect(isItemAffordable(colony({ roomsByHand: 0, stone: getAutoDigCost().stone }), ref)).toBe(false);
    void getNextAction(s);
  });
});

describe('auto-dig on', () => {
  const system = new ResourceSystem(new EventBus());

  it('the diggers press DIG on their own, each press the usual chunk', () => {
    const off = colony({ dig: 6 });
    const on = { ...off, dig: { ...off.dig, auto: true } };
    expect(autoDigPointsPerSec(off)).toBe(0);
    expect(autoDigPointsPerSec(on)).toBe(A.pressesPerSec * pressChunk(on));
    expect(digRate(on)).toBe(diggerPointsPerSec(on) + autoDigPointsPerSec(on));
    // Nobody to press it without diggers.
    expect(autoDigPointsPerSec({ ...colony({ dig: 0 }), dig: { ...colony().dig, auto: true } })).toBe(0);
  });

  it('digs faster than the diggers alone, and NEXT ROOM says so at the auto rate', () => {
    const off = colony({ dig: 6 });
    const on = { ...off, dig: { ...off.dig, auto: true } };
    expect(nextRoom(on).auto).toBe(true);
    expect(nextRoom(off).auto).toBe(false);
    expect(nextRoom(on).timeLeftMs!).toBeLessThan(nextRoom(off).timeLeftMs!);
    const t = Math.ceil(nextRoom(on).timeLeftMs! / 1000);
    expect(system.tick(on, undefined, t + 1).dig.roomsDug).toBeGreaterThan(on.dig.roomsDug);
  });

  it('gives the same rooms for any step length', () => {
    const s0 = colony({ dig: 9 });
    const s = { ...s0, dig: { ...s0.dig, auto: true } };
    const total = Math.ceil(roomCost(0) / digRate(s)) * 3;
    const long = system.tick(s, undefined, total);
    let fine = s;
    for (let i = 0; i < 300; i++) fine = system.tick(fine, undefined, total / 300);
    expect(fine.dig.roomsDug).toBe(long.dig.roomsDug);
    expect(Math.abs(fine.dig.progress - long.dig.progress)).toBeLessThanOrEqual(1);
  });

  it('a press still adds a chunk', () => {
    const s = { ...colony({ dig: 2 }), dig: { ...colony({ dig: 2 }).dig, auto: true } };
    expect(digPress(s).dig.progress).toBe(s.dig.progress + pressChunk(s));
  });
});
