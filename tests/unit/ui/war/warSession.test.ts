import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { createWarSession, MIN_REPLAY_MS, type WarSession } from '../../../../src/ui/war/warSession';
import { getEnemyDefs } from '../../../../src/systems/EnemySystem';
import type { BattleResult } from '../../../../src/systems/BattleSystem';
import { testActions } from '../../helpers/actions';
import { makeState } from '../../helpers/makeState';

/**
 * Story 1.25 (UX-DR26): the WAR segment's battle. The enemy card shows the
 * enemy FIGHT will fight; a battle resolves at once (the state is written),
 * then a round counter replays its rounds and the summary opens at the end.
 */

let session: WarSession;
let done: Array<{ result: BattleResult; enemyName: string }>;

function start(soldiers = 50): void {
  gameState.value = makeState({ phase: Phase.COMBAT, combatSoldiers: soldiers, equipment: { weapon: 5, armor: 5 } });
  done = [];
  session = createWarSession({
    actions: testActions(),
    onBattleDone: (result, enemy) => done.push({ result, enemyName: enemy.name }),
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  session.dispose();
  vi.useRealTimers();
});

describe('war session (Story 1.25)', () => {
  it('always has a known enemy on the card, before any fight', () => {
    start(0);
    const types = getEnemyDefs().map((e) => e.type);
    expect(types).toContain(session.enemy.value.type);
    expect(session.battle.value.status).toBe('idle');
  });

  it('refuses to fight without soldiers and writes nothing', () => {
    start(0);
    const before = gameState.value;
    const r = session.fight();
    expect(r.ok).toBe(false);
    expect(gameState.value).toBe(before);
    expect(session.battle.value.status).toBe('idle');
  });

  it('fights the enemy on the card, counts its rounds up, then reports it and draws the next enemy', () => {
    start();
    const shown = session.enemy.value;
    const r = session.fight();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.enemyType).toBe(shown.type);
    // The battle is written at once; the counter replays it.
    expect(gameState.value.lastBattle.status).toBe('done');
    const running = session.battle.value;
    expect(running.status).toBe('running');
    if (running.status !== 'running') return;
    expect(running.round).toBe(1);
    expect(running.rounds).toBe(r.value.rounds);
    expect(done).toHaveLength(0);

    let last = running.round;
    while (session.battle.value.status === 'running') {
      vi.advanceTimersByTime(10);
      const b = session.battle.value;
      if (b.status === 'running') {
        expect(b.round).toBeGreaterThanOrEqual(last);
        expect(b.round).toBeLessThanOrEqual(b.rounds);
        last = b.round;
      }
    }
    expect(done).toHaveLength(1);
    expect(done[0].result).toBe(r.value);
    expect(done[0].enemyName).toBe(shown.name);
    expect(['victory', 'defeat', 'draw']).toContain(done[0].result.outcome);
  });

  it('finishes the replay within its cap however many rounds the battle lasted', () => {
    start();
    session.fight();
    vi.advanceTimersByTime(session.maxReplayMs);
    expect(session.battle.value.status).toBe('idle');
    expect(done).toHaveLength(1);
  });

  it('refuses a second fight while one is replaying', () => {
    start();
    expect(session.fight().ok).toBe(true);
    const after = gameState.value;
    const again = session.fight();
    expect(again).toEqual({ ok: false, reason: 'already_running' });
    expect(gameState.value).toBe(after);
  });

  it('keeps the battles of this session, newest first', () => {
    start();
    session.fight();
    vi.advanceTimersByTime(session.maxReplayMs);
    session.fight();
    vi.advanceTimersByTime(session.maxReplayMs);
    expect(session.history.value).toHaveLength(2);
    expect(session.history.value[0].result).toBe(done[1].result);
  });
});

describe('war session replay length (Story 1.25)', () => {
  it('shows even a one-round battle for a while', () => {
    start();
    session.fight();
    vi.advanceTimersByTime(MIN_REPLAY_MS - 50);
    expect(session.battle.value.status).toBe('running');
  });
});
