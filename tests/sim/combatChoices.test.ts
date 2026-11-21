import { describe, expect, it } from 'vitest';
import { armyOf, fightRounds } from '../../src/systems/CombatRounds';
import { getEnemyDef, scaleEnemy, type EnemyDef } from '../../src/systems/EnemySystem';
import { MUTATIONS, getMutationEffects } from '../../src/systems/MutationSystem';
import { getEffects, type BuildingType } from '../../src/systems/BuildingSystem';
import { itemEffects, itemKey, itemPanel, itemPrice, listItems, type ItemRef } from '../../src/systems/NextAction';
import { CRITICAL_PATH } from '../../src/data/content/criticalPath';
import { BUILDING_MAX_LEVEL, BUILDING_UNLOCK_PHASE } from '../../src/data/content/buildings';
import { FIRST_PRODUCED_IN, type ProducedResource } from '../../src/data/content/producers';
import { PANEL_PLACEMENT, isUnlocked } from '../../src/data/content/tabs';
import { ENEMIES, ENEMY_TYPES, TRAITS, type EnemyType, type TraitId } from '../../src/data/content/enemies';
import { enemyBalance } from '../../src/data/balance/enemies';
import { soldierBalance } from '../../src/data/balance/soldiers';
import { combatBalance } from '../../src/data/balance/combat';
import { Phase } from '../../src/phases/phases';
import type { GameState } from '../../src/state/GameState';
import { makeState } from '../unit/helpers/makeState';
import { fixedRng } from '../unit/helpers/rng';
import { dominates, dominatesProfile, purchasablesIn, type Profile } from '../unit/helpers/choices';

/**
 * Story 4.8 (FR19, Phase 3 upgrades): Combat's equipment, mutations and
 * combat buildings compete for Phase 3's currencies and none is strictly
 * dominant: for any two of them bought from the same colony, neither costs
 * the same or less in every currency while giving at least as much on every
 * effect. Effects are measured, never restated: what the purchase does to
 * the army a win needs against each enemy trait (as in `counters.test.ts`),
 * plus the colony and building effects it adds. Relations only.
 */

/** Phase 3's purchasables: its equipment, its mutations and the buildings that open with the battles. */
const PHASE3: ItemRef[] = listItems().filter(
  (ref) => ref.kind === 'equipment' || ref.kind === 'mutation' || (ref.kind === 'building' && BUILDING_UNLOCK_PHASE[ref.id] === Phase.COMBAT),
);

/** The workshop each piece of equipment needs standing. */
const WORKSHOP = { weapon: 'chitin_armory', armor: 'silk_weaving' } as const satisfies Record<'weapon' | 'armor', BuildingType>;

const LEVELS = Array.from({ length: soldierBalance.maxEquipmentLevel }, (_, i) => i + 1);
const BUILDING_LEVELS = [1, 2, 3];

/** One sale: an item at the level it is bought at (equipment and buildings are bought level by level). */
interface Sale {
  readonly ref: ItemRef;
  readonly level: number;
}

const SALES: Sale[] = PHASE3.flatMap((ref): Sale[] => {
  if (ref.kind === 'equipment') return LEVELS.map((level) => ({ ref, level }));
  if (ref.kind === 'building') return BUILDING_LEVELS.filter((level) => level <= (BUILDING_MAX_LEVEL[ref.id] ?? Infinity)).map((level) => ({ ref, level }));
  return [{ ref, level: 1 }];
});

const saleName = (s: Sale): string => (s.ref.kind === 'mutation' ? itemKey(s.ref) : `${itemKey(s.ref)} Lv.${s.level}`);
const mutationDef = (id: string) => MUTATIONS.find((m) => m.id === id)!;

/** What a sale needs bought before it: the level below, and a mutation's prerequisite. */
function prerequisites(s: Sale): { mutations: string[]; equipment: Partial<Record<'weapon' | 'armor', number>>; buildings: Partial<Record<BuildingType, number>> } {
  if (s.ref.kind === 'equipment') return { mutations: [], equipment: { [s.ref.id]: s.level - 1 }, buildings: {} };
  if (s.ref.kind === 'building') return { mutations: [], equipment: {}, buildings: { [s.ref.id]: s.level - 1 } };
  const pre = s.ref.kind === 'mutation' ? mutationDef(s.ref.id).prerequisite : null;
  // Potent Venom raises venom's damage: it lands only with a Venom Lab standing.
  const buildings: Partial<Record<BuildingType, number>> = s.ref.kind === 'mutation' && s.ref.id === 'potent_venom' ? { venom_lab: 1 } : {};
  return { mutations: pre ? [pre] : [], equipment: {}, buildings };
}

/**
 * The colony both sales could be bought from: a fresh Phase 3 colony with
 * both sales' prerequisites and venom in stock (so venom can land). Its
 * workshops stand only where an equipment level above the first needs one.
 */
function baseFor(a: Sale, b: Sale): GameState {
  const pa = prerequisites(a);
  const pb = prerequisites(b);
  const owned = new Set([...pa.mutations, ...pb.mutations]);
  const workshops: Partial<Record<BuildingType, number>> = {};
  for (const sale of [a, b]) {
    if (sale.ref.kind === 'equipment' && sale.level > 1) workshops[WORKSHOP[sale.ref.id]] = 1;
  }
  const s = makeState({
    phase: 'combat',
    combatResources: { venom: combatBalance.venomPerBattle },
    equipment: { ...pa.equipment, ...pb.equipment },
  });
  const buildings: Record<string, { level: number }> = { ...s.buildings };
  for (const [id, level] of Object.entries({ ...workshops, ...pa.buildings, ...pb.buildings }) as [BuildingType, number][]) {
    buildings[id] = { ...buildings[id], level: Math.max(buildings[id].level, level) };
  }
  return { ...s, buildings: buildings as GameState['buildings'], mutations: s.mutations.map((m) => ({ ...m, purchased: owned.has(m.id) })) };
}

/** The colony after the sale. */
function buy(s: GameState, sale: Sale): GameState {
  const ref = sale.ref;
  if (ref.kind === 'equipment') return { ...s, equipment: { ...s.equipment, [ref.id]: s.equipment[ref.id] + 1 } };
  if (ref.kind === 'building') return { ...s, buildings: { ...s.buildings, [ref.id]: { ...s.buildings[ref.id], level: s.buildings[ref.id].level + 1 } } };
  if (ref.kind === 'mutation') return { ...s, mutations: s.mutations.map((m) => (m.id === ref.id ? { ...m, purchased: true } : m)) };
  return s;
}

const MOST = 100_000;
const hint = (): ReturnType<typeof fixedRng> => fixedRng(enemyBalance.matchup.roll);

/** The smallest army (a real number, by bisection) that beats `enemy` with every roll fixed. */
function armyNeeded(state: GameState, enemy: EnemyDef): number {
  const wins = (n: number): boolean => fightRounds(armyOf(state, n), enemy, hint()).outcome === 'victory';
  if (!wins(MOST)) return MOST;
  let lo = 0;
  let hi = MOST;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (wins(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

const enemyWith = (trait: TraitId): EnemyType => ENEMY_TYPES.find((t) => ENEMIES[t].trait === trait)!;
const WON = Array.from({ length: enemyBalance.bossFromBattlesWon }, (_, i) => i);

/** Building effects by name, as numbers (a building effect that counts or unlocks something). */
function buildingEffects(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ref of PHASE3) {
    if (ref.kind !== 'building') continue;
    for (const [k, v] of Object.entries(getEffects(ref.id, s.buildings[ref.id].level))) out[`${ref.id}.${k}`] = v;
  }
  return out;
}

/** What the sale gives over `base`: per trait, the share by which the army a win needs shrinks; then the colony's and buildings' effects. */
function effectsOf(base: GameState, after: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const trait of Object.keys(TRAITS) as TraitId[]) {
    const ratios = WON.map((won) => {
      const enemy = scaleEnemy(getEnemyDef(enemyWith(trait)), won);
      return armyNeeded(base, enemy) / armyNeeded(after, enemy);
    });
    out[`fight.${trait}`] = ratios.reduce((x, y) => x + y, 0) / ratios.length - 1;
  }
  const mb = getMutationEffects(base);
  const ma = getMutationEffects(after);
  out['colony.gatherRate'] = ma.gatherRate - mb.gatherRate;
  out['colony.hatchRate'] = ma.hatchRate - mb.hatchRate;
  const bb = buildingEffects(base);
  const ba = buildingEffects(after);
  for (const k of new Set([...Object.keys(bb), ...Object.keys(ba)])) out[k] = (ba[k] ?? 0) - (bb[k] ?? 0);
  return out;
}

/**
 * The sale's price from `base`: the item's own, and for a first equipment
 * level with no workshop standing, the workshop's too (the armory is bought
 * for the weapon, never instead of it).
 */
function priceOf(sale: Sale, base: GameState): Record<string, number> {
  const cost: Record<string, number> = {};
  const add = (price: Readonly<Record<string, number | undefined>>) => {
    for (const [k, v] of Object.entries(price)) if (v) cost[k] = (cost[k] ?? 0) + v;
  };
  add(itemPrice(base, sale.ref));
  if (sale.ref.kind === 'equipment') {
    const workshop = WORKSHOP[sale.ref.id];
    if (base.buildings[workshop].level < 1) add(itemPrice(base, { kind: 'building', id: workshop }));
  }
  return cost;
}

function profile(sale: Sale, base: GameState): Profile {
  return { cost: priceOf(sale, base), effects: effectsOf(base, buy(base, sale)) };
}

/** Two sales the player chooses between: not levels of one item, and neither the other's prerequisite. */
function alternatives(a: Sale, b: Sale): boolean {
  if (itemKey(a.ref) === itemKey(b.ref)) return false;
  const pre = (x: Sale) => (x.ref.kind === 'mutation' ? mutationDef(x.ref.id).prerequisite : null);
  if (a.ref.kind === 'mutation' && pre(b) === a.ref.id) return false;
  if (b.ref.kind === 'mutation' && pre(a) === b.ref.id) return false;
  // A workshop opens its equipment: the equipment is bought after it, never instead.
  const opens = (w: Sale, e: Sale) => w.ref.kind === 'building' && e.ref.kind === 'equipment' && WORKSHOP[e.ref.id] === w.ref.id;
  if (opens(a, b) || opens(b, a)) return false;
  // Likewise the Venom Lab for Potent Venom.
  const lab = (l: Sale, m: Sale) => itemKey(l.ref) === 'building:venom_lab' && itemKey(m.ref) === 'mutation:potent_venom';
  if (lab(a, b) || lab(b, a)) return false;
  return true;
}

const phase3Currency = (k: string): boolean => k in FIRST_PRODUCED_IN && isUnlocked(FIRST_PRODUCED_IN[k as ProducedResource], Phase.COMBAT);
const firstInCombat = (k: string): boolean => k in FIRST_PRODUCED_IN && FIRST_PRODUCED_IN[k as ProducedResource] === Phase.COMBAT;

describe('Combat has choices worth making (Story 4.8, FR19)', () => {
  const fresh = makeState({ phase: 'combat' });
  const prices = PHASE3.map((ref) => Object.keys(itemPrice(fresh, ref)));

  it('lists at least 4 equipment, mutations and combat buildings, each sold in Combat', () => {
    expect(PHASE3.length).toBeGreaterThanOrEqual(4);
    for (const ref of PHASE3) expect(isUnlocked(PANEL_PLACEMENT[itemPanel(ref)].unlockPhase, Phase.COMBAT), itemKey(ref)).toBe(true);
  });

  it('every one is paid in Phase 3 currencies and shares one with another (they compete)', () => {
    prices.forEach((keys, i) => {
      const name = itemKey(PHASE3[i]);
      expect(keys.length, name).toBeGreaterThan(0);
      for (const k of keys) expect(phase3Currency(k), `${name} ${k}`).toBe(true);
      const shared = keys.filter((k) => prices.some((other, j) => j !== i && other.includes(k)));
      expect(shared, name).not.toEqual([]);
    });
  });

  it("Combat's own loot (chitin, silk, venom) is fought over by at least 4 of them", () => {
    const loot = PHASE3.filter((_, i) => prices[i].some(firstInCombat));
    expect(loot.length).toBeGreaterThanOrEqual(4);
  });

  it("Phase 3's critical-path table lists every one of them", () => {
    const path = CRITICAL_PATH[Phase.COMBAT].map(itemKey);
    for (const ref of PHASE3) expect(path, itemKey(ref)).toContain(itemKey(ref));
  });

  it('every sale gives something: a level that changes nothing is not sold', () => {
    for (const sale of SALES) {
      const base = baseFor(sale, sale);
      const gains = Object.values(profile(sale, base).effects);
      expect(gains.some((g) => (g ?? 0) > 0), saleName(sale)).toBe(true);
    }
  }, 120_000);

  it('as data (itemEffects, the check Phases 1 and 2 use): each describes its effects, and none dominates another', () => {
    // A Combat colony with its workshops standing, so the equipment is on sale too.
    const s = makeState({ phase: 'combat', buildings: { chitin_armory: { level: 1 }, silk_weaving: { level: 1 } } });
    const sold = purchasablesIn(Phase.COMBAT, s).filter((ref) => PHASE3.some((p) => itemKey(p) === itemKey(ref)));
    expect(sold.length).toBeGreaterThanOrEqual(4);
    for (const ref of sold) {
      const fx = itemEffects(s, ref);
      expect(fx, itemKey(ref)).not.toBeNull();
      expect(Object.values(fx ?? {}).some((v) => v > 0), itemKey(ref)).toBe(true);
    }
    const pairs = sold.flatMap((a) => sold.filter((b) => b !== a && dominates(s, a, b)).map((b) => `${itemKey(a)} dominates ${itemKey(b)}`));
    expect(pairs).toEqual([]);
  });

  it('none is strictly dominant: no sale costs the same or less and gives at least as much as another', () => {
    const dominated: string[] = [];
    for (const a of SALES) {
      for (const b of SALES) {
        if (a === b || !alternatives(a, b)) continue;
        const base = baseFor(a, b);
        const pa = profile(a, base);
        const pb = profile(b, base);
        if (dominatesProfile(pa, pb)) dominated.push(`${saleName(a)} dominates ${saleName(b)}: ${JSON.stringify(pa)} vs ${JSON.stringify(pb)}`);
      }
    }
    expect(dominated).toEqual([]);
  }, 120_000);
});
