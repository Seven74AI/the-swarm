import { afterEach, describe, expect, it } from 'vitest';
import { h } from 'preact';
import { cleanup, render } from '@testing-library/preact';
import '@preact/signals';
import { Phase } from '../../src/phases/phases';
import { conditionMet, goalFor } from '../../src/phases/transitions';
import { gameState } from '../../src/state/gameSignal';
import type { GameState } from '../../src/state/GameState';
import { DECISIONS } from '../../src/data/content/decisions';
import { MVP_PHASES, NARRATIVE_BEATS, type MvpPhase } from '../../src/data/content/narrative';
import { FIRST_PRODUCED_IN, type ProducedResource } from '../../src/data/content/producers';
import { ENEMIES, TRAITS, type EnemyType } from '../../src/data/content/enemies';
import { itemCost, itemKey, type ItemRef } from '../../src/systems/NextAction';
import { getRandomEnemy } from '../../src/systems/EnemySystem';
import { BattleSystem } from '../../src/systems/BattleSystem';
import { EventBus } from '../../src/engine/EventBus';
import { LOSS_CAUSES, WIN_CAUSES, causeLine } from '../../src/systems/BattleCauses';
import type { BattleOutcome } from '../../src/systems/CombatRounds';
import { armyUpkeepPerSec, computeResourceRates } from '../../src/systems/ResourceSystem';
import { GoalMeter } from '../../src/ui/shell/GoalMeter';
import { dominates, freshIn, purchasablesIn } from './helpers/choices';
import { makeState } from './helpers/makeState';
import { fixedRng } from './helpers/rng';

/**
 * Story 4.11 (FR19, FR12, FR14; GDD Level Progression "Depth bar for a
 * complete phase"): each MVP phase is complete as a fact. For Egg Laying,
 * Colony and Combat:
 * - at least 3 decision events unique to the phase;
 * - at least 4 purchasables competing for the phase's own currencies, none
 *   strictly dominant (helpers/choices.ts);
 * - an entry beat and a near-goal beat;
 * - a goal readout with one condition row per guard condition.
 * Combat also has at least 3 enemy types with traits, a battle cause for every
 * outcome, and soldiers that cost food upkeep.
 *
 * Everything is read from the content tables and systems: no count, price or
 * threshold is restated here, only the bar itself.
 */

/** The depth bar (GDD decision 13). These are the bar, not balance. */
const BAR = { decisionEvents: 3, purchasables: 4, enemyTypes: 3 } as const;

/** Currencies first produced in `phase`: the stock the phase's purchases compete for. */
const currenciesOf = (phase: MvpPhase): string[] =>
  (Object.keys(FIRST_PRODUCED_IN) as ProducedResource[]).filter((k) => FIRST_PRODUCED_IN[k] === phase);

/** The phase's purchasables that spend at least one of its own currencies. */
function competingIn(phase: MvpPhase): ItemRef[] {
  const s = freshIn(phase);
  const own = new Set(currenciesOf(phase));
  return purchasablesIn(phase, s).filter((ref) => Object.keys(itemCost(s, ref) ?? {}).some((k) => own.has(k)));
}

/** A colony far past every goal: every condition of a phase's guard is met in it. */
function pastEveryGoal(phase: MvpPhase): GameState {
  const lots = 1e9;
  return makeState({
    phase,
    resources: { workers: lots, food: lots, nestCapacity: lots, wood: lots, stone: lots, nectar: lots },
    workersAssigned: { gather: lots, forage: lots, tend: lots, dig: lots, guard: lots },
    battlesWon: lots,
  });
}

describe.each(MVP_PHASES)('depth bar: %s (Story 4.11)', (phase) => {
  it(`has at least ${BAR.decisionEvents} decision events unique to it`, () => {
    const own = DECISIONS.filter((d) => d.phases.length === 1 && d.phases[0] === phase);
    expect(own.length).toBeGreaterThanOrEqual(BAR.decisionEvents);
    expect(new Set(own.map((d) => d.id)).size).toBe(own.length);
    expect(new Set(own.map((d) => d.title)).size).toBe(own.length);
  });

  it(`has at least ${BAR.purchasables} purchasables competing for its currencies, none strictly dominant`, () => {
    expect(currenciesOf(phase).length).toBeGreaterThan(0);
    const items = competingIn(phase);
    expect(items.map(itemKey).length).toBeGreaterThanOrEqual(BAR.purchasables);
    const s = freshIn(phase);
    for (const a of items) {
      for (const b of items) {
        if (a === b) continue;
        expect(dominates(s, a, b), `${itemKey(a)} dominates ${itemKey(b)}`).toBe(false);
      }
    }
  });

  it('has an entry beat and a near-goal beat, distinct and its own', () => {
    const { entry, nearGoal } = NARRATIVE_BEATS[phase];
    for (const beat of [entry, nearGoal]) {
      expect(beat.text.trim().length).toBeGreaterThan(0);
      expect(beat.from).toBe(phase);
    }
    expect(entry.text).not.toBe(nearGoal.text);
    const others = MVP_PHASES.filter((p) => p !== phase).flatMap((p) => [NARRATIVE_BEATS[p].entry.text, NARRATIVE_BEATS[p].nearGoal.text]);
    expect(others).not.toContain(entry.text);
    expect(others).not.toContain(nearGoal.text);
  });

  describe('goal readout', () => {
    const initial = gameState.value;
    afterEach(() => {
      cleanup();
      gameState.value = initial;
    });

    it('the guard is exactly its conditions: unmet on a fresh colony, met once every condition is', () => {
      const goal = goalFor(phase)!;
      expect(goal).not.toBeNull();
      expect(goal.conditions.length).toBeGreaterThan(0);
      for (const s of [freshIn(phase), pastEveryGoal(phase)]) {
        expect(goal.guard(s)).toBe(goal.conditions.every((c) => conditionMet(c, s)));
      }
      expect(goal.guard(freshIn(phase))).toBe(false);
      expect(goal.guard(pastEveryGoal(phase))).toBe(true);
    });

    it('shows one condition row per guard condition', () => {
      const goal = goalFor(phase)!;
      gameState.value = freshIn(phase);
      const { container } = render(h(GoalMeter, null));
      const rows = [...container.querySelectorAll('[data-goal-conditions] > li[data-condition]')];
      expect(rows.map((r) => r.getAttribute('data-condition'))).toEqual(goal.conditions.map((c) => c.id));
      for (const row of rows) expect(row.querySelector('[data-condition-value]')?.textContent?.length).toBeGreaterThan(0);
    });
  });
});

describe('depth bar: combat extras (Story 4.11)', () => {
  /** Every enemy the Combat phase can draw before its goal is met (one draw per slot of the draw table). */
  function combatEnemies(): EnemyType[] {
    const goal = goalFor(Phase.COMBAT)!;
    const battles = goal.conditions.find((c) => c.id === 'battlesWon')!.target(freshIn(Phase.COMBAT));
    const seen = new Set<EnemyType>();
    const slots = 1000;
    for (let won = 0; won < battles; won++) {
      for (let i = 0; i < slots; i++) seen.add(getRandomEnemy(won, fixedRng(i / slots)).type as EnemyType);
    }
    return [...seen];
  }

  it(`can draw at least ${BAR.enemyTypes} enemy types, each with its own trait`, () => {
    const types = combatEnemies();
    expect(types.length).toBeGreaterThanOrEqual(BAR.enemyTypes);
    const traits = types.map((t) => ENEMIES[t].trait);
    expect(new Set(traits).size).toBe(types.length);
    for (const t of traits) {
      expect(TRAITS[t].label.length).toBeGreaterThan(0);
      expect(TRAITS[t].affects.length).toBeGreaterThan(0);
    }
  });

  it('gives every battle outcome a cause, with a line', () => {
    const outcomes: Record<BattleOutcome, boolean> = { victory: false, defeat: false, draw: false };
    const battles = new BattleSystem(new EventBus());
    const armies = [0, 1, 5, 20, 100, 1000];
    for (const type of combatEnemies()) {
      for (const soldiers of armies) {
        for (const roll of [0, 0.5, 0.999]) {
          const s = makeState({ phase: Phase.COMBAT, combatSoldiers: soldiers, nextEnemy: type });
          const { result } = battles.resolveBattle(s, type, fixedRng(roll));
          outcomes[result.outcome] = true;
          const allowed = result.outcome === 'victory' ? WIN_CAUSES : LOSS_CAUSES;
          expect(allowed, `${type} ×${soldiers}: ${result.outcome}`).toContain(result.cause.kind);
          expect(causeLine(result.cause).length).toBeGreaterThan(0);
        }
      }
    }
    // Both a win and a loss were fought: the causes above cover each side.
    expect(outcomes.victory).toBe(true);
    expect(outcomes.defeat || outcomes.draw).toBe(true);
  });

  it('soldiers cost food upkeep: a bigger army eats more', () => {
    const none = makeState({ phase: Phase.COMBAT, combatSoldiers: 0, soldierPipeline: { count: 0, progress: 0 } });
    const army = { ...none, combatSoldiers: 10 };
    const bigger = { ...none, combatSoldiers: 20 };
    expect(armyUpkeepPerSec(none)).toBe(0);
    expect(armyUpkeepPerSec(army)).toBeGreaterThan(0);
    const eats = (s: GameState) => computeResourceRates(s).foodConsumedPerSec;
    expect(eats(army)).toBeGreaterThan(eats(none));
    expect(eats(bigger)).toBeGreaterThan(eats(army));
  });
});
