import { describe, expect, it } from 'vitest';
import { armyOf, fightRounds } from '../../src/systems/CombatRounds';
import { getEnemyDef, scaleEnemy, type EnemyDef } from '../../src/systems/EnemySystem';
import { MUTATIONS } from '../../src/systems/MutationSystem';
import { marksOf, type Upgrade } from '../../src/systems/Counters';
import { enemyBalance } from '../../src/data/balance/enemies';
import { soldierBalance } from '../../src/data/balance/soldiers';
import { combatBalance } from '../../src/data/balance/combat';
import { ENEMIES, ENEMY_TYPES, TRAITS, type EnemyType, type TraitId } from '../../src/data/content/enemies';
import type { GameState } from '../../src/state/GameState';
import { makeState, type StateOverrides } from '../unit/helpers/makeState';
import { fixedRng } from '../unit/helpers/rng';

/**
 * Story 4.2 (FR9, FR10, FR12): every weapon and armor level and every
 * mutation is marked, in `data/balance/combat.ts`, as strong against at least
 * one trait and weak (no bonus, or a weaker one) against at least one other.
 * The marks are checked against the real fight: the upgrade must shrink the
 * army a win needs by more against each trait it is strong against than
 * against any trait it is weak against. Relations only, never the sizes.
 */

const LEVELS = Array.from({ length: soldierBalance.maxEquipmentLevel }, (_, i) => i + 1);
const UPGRADES: Upgrade[] = [
  ...LEVELS.map((level): Upgrade => ({ kind: 'equipment', id: 'weapon', level })),
  ...LEVELS.map((level): Upgrade => ({ kind: 'equipment', id: 'armor', level })),
  ...MUTATIONS.map((m): Upgrade => ({ kind: 'mutation', id: m.id })),
];

const name = (u: Upgrade): string => (u.kind === 'equipment' ? `${u.id} Lv.${u.level}` : u.id);
const owned = (ids: string[]) => makeState().mutations.map((m) => ({ ...m, purchased: ids.includes(m.id) }));
/** Venom needs a Venom Lab and venom in stock to land at all. */
const venomLab: StateOverrides = { buildings: { venom_lab: { level: 1 } }, combatResources: { venom: combatBalance.venomPerBattle } };

/** The army without the upgrade, and with it (everything else as a fresh Phase 3 army). */
function before(u: Upgrade): GameState {
  if (u.kind === 'equipment') return makeState({ phase: 'combat', equipment: { [u.id]: u.level - 1 } });
  return makeState({ phase: 'combat', ...(u.id === 'potent_venom' ? venomLab : {}) });
}
function after(u: Upgrade): GameState {
  if (u.kind === 'equipment') return makeState({ phase: 'combat', equipment: { [u.id]: u.level } });
  return makeState({ phase: 'combat', ...(u.id === 'potent_venom' ? venomLab : {}), mutations: owned([u.id]) });
}

const hint = (): ReturnType<typeof fixedRng> => fixedRng(enemyBalance.matchup.roll);
const MOST = 100_000;

/** The smallest army (a real number, by bisection) that beats `enemy` with every roll fixed. */
function armyNeeded(state: GameState, enemy: EnemyDef): number {
  const wins = (n: number): boolean => fightRounds(armyOf(state, n), enemy, hint()).outcome === 'victory';
  if (!wins(MOST)) return Infinity;
  let lo = 0;
  let hi = MOST;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (wins(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

const enemyWith = (trait: TraitId): EnemyType => ENEMY_TYPES.find((t) => ENEMIES[t].trait === trait)!;
/** The battles won in Phase 3, before the boss joins: the upgrade is judged over all of them. */
const WON = Array.from({ length: enemyBalance.bossFromBattlesWon }, (_, i) => i);

/** How many times smaller the army a win needs gets with the upgrade, on average over `WON` (1: no bonus). */
function gain(u: Upgrade, trait: TraitId): number {
  const ratios = WON.map((won) => {
    const enemy = scaleEnemy(getEnemyDef(enemyWith(trait)), won);
    return armyNeeded(before(u), enemy) / armyNeeded(after(u), enemy);
  });
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

describe('equipment and mutations counter traits (Story 4.2)', () => {
  it('every trait is carried by an enemy type, and a fresh army can beat each one', () => {
    for (const trait of Object.keys(TRAITS) as TraitId[]) {
      expect(enemyWith(trait), trait).toBeDefined();
      for (const won of WON) expect(armyNeeded(makeState({ phase: 'combat' }), scaleEnemy(getEnemyDef(enemyWith(trait)), won))).toBeLessThan(Infinity);
    }
  });

  it.each(UPGRADES.map((u) => [name(u), u] as const))('%s is marked strong against one trait and weak against another', (_, u) => {
    const marks = marksOf(u);
    expect(marks.strongAgainst.length).toBeGreaterThanOrEqual(1);
    expect(marks.weakAgainst.length).toBeGreaterThanOrEqual(1);
    for (const t of [...marks.strongAgainst, ...marks.weakAgainst]) expect(Object.keys(TRAITS)).toContain(t);
    expect(marks.strongAgainst.filter((t) => marks.weakAgainst.includes(t))).toEqual([]);
  });

  it.each(UPGRADES.map((u) => [name(u), u] as const))('%s: the fight agrees with its marks', (_, u) => {
    const { strongAgainst, weakAgainst } = marksOf(u);
    const gains = Object.fromEntries((Object.keys(TRAITS) as TraitId[]).map((t) => [t, gain(u, t)]));
    const detail = JSON.stringify(gains);
    for (const s of strongAgainst) {
      expect(gains[s], `${s} ${detail}`).toBeGreaterThan(1);
      for (const w of weakAgainst) expect(gains[s], `${s} over ${w} ${detail}`).toBeGreaterThan(gains[w]);
    }
  });
});
