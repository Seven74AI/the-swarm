import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { BattleSystem } from '../../src/systems/BattleSystem';
import { getRandomEnemy } from '../../src/systems/EnemySystem';
import { enemyBalance } from '../../src/data/balance/enemies';
import { combatBalance } from '../../src/data/balance/combat';
import { ENEMIES, type EnemyType } from '../../src/data/content/enemies';
import { rngFromSeed, rngStream } from '../../src/utils/rng';
import type { GameState } from '../../src/state/GameState';
import { makeState, type StateOverrides } from '../unit/helpers/makeState';

/**
 * Story 4.1 (FR12, the combat interest bar): preparing for a battle is a
 * decision. A fixed set of builds (soldier count, equipment, mutations) fights
 * every enemy type that can appear in Phase 3 over a fixed set of seeds and
 * battle counts. No build may have the best win rate against every type:
 * each one is beaten by another build somewhere. The relation is asserted,
 * never the rates, so retuning keeps the test as long as the traits matter.
 */

/** One investment, three levels deep: what a Phase 3 colony can afford in each. */
const LEVEL = 3;
/**
 * The builds, at a comparable outlay for an army of `few`: twice the plain
 * soldiers, or `few` soldiers with weapons, armor or a Venom Lab.
 */
const BUILDS: Readonly<Record<string, (few: number) => StateOverrides>> = {
  horde: (few) => ({ combatSoldiers: 2 * few }),
  weapons: (few) => ({ combatSoldiers: few, equipment: { weapon: LEVEL } }),
  armor: (few) => ({ combatSoldiers: few, equipment: { armor: LEVEL } }),
  venom: (few) => ({
    combatSoldiers: few,
    buildings: { venom_lab: { level: LEVEL } },
    combatResources: { venom: combatBalance.venomPerBattle },
  }),
};
/** Army sizes from a first squad to a grown one, so no single size decides it. */
const SIZES = [3, 4, 5, 6, 8, 10, 14];

/** The types the generator can draw before the boss joins: Phase 3's enemies. */
function phase3Types(): EnemyType[] {
  const seen = new Set<EnemyType>();
  const rng = rngStream(1);
  for (let won = 0; won < enemyBalance.bossFromBattlesWon; won++) {
    for (let i = 0; i < 200; i++) seen.add(getRandomEnemy(won, rng).type as EnemyType);
  }
  return [...seen].sort();
}

const SEEDS = Array.from({ length: 6 }, (_, i) => i + 1);
const BATTLES_WON = Array.from({ length: enemyBalance.bossFromBattlesWon }, (_, i) => i);

function winRate(build: (few: number) => StateOverrides, enemy: EnemyType): number {
  const system = new BattleSystem(new EventBus());
  let wins = 0;
  let fights = 0;
  for (const few of SIZES) {
    for (const won of BATTLES_WON) {
      for (const seed of SEEDS) {
        const state: GameState = makeState({ phase: 'combat', ...build(few), battlesWon: won, nextEnemy: enemy, rng: rngFromSeed(seed) });
        if (system.resolveBattle(state).result.outcome === 'victory') wins++;
        fights++;
      }
    }
  }
  return wins / fights;
}

describe('no single build is best against every Phase 3 enemy (Story 4.1, FR12)', () => {
  const types = phase3Types();
  const rates = Object.fromEntries(Object.entries(BUILDS).map(([id, b]) => [id, Object.fromEntries(types.map((t) => [t, winRate(b, t)]))]));

  it('fights at least 3 types with different traits', () => {
    expect(types.length).toBeGreaterThanOrEqual(3);
    expect(new Set(types.map((t) => ENEMIES[t].trait)).size).toBeGreaterThanOrEqual(3);
  });

  it('every build is beaten by another build against some type', () => {
    const unbeaten = Object.keys(BUILDS).filter((id) =>
      types.every((t) => Object.keys(BUILDS).every((other) => rates[other][t] <= rates[id][t])),
    );
    expect(unbeaten, JSON.stringify(rates)).toEqual([]);
  });

  it('the best build differs between types', () => {
    const best = types.map((t) => {
      const top = Math.max(...Object.keys(BUILDS).map((id) => rates[id][t]));
      return Object.keys(BUILDS).filter((id) => rates[id][t] === top).join('+');
    });
    expect(new Set(best).size, JSON.stringify(rates)).toBeGreaterThan(1);
  });
});
