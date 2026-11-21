import type { GameState } from '../state/GameState';
import type { TraitId } from '../data/content/enemies';
import type { ItemRef } from '../data/content/criticalPath';
import { combatBalance, type CounterMarks } from '../data/balance/combat';
import { soldierBalance } from '../data/balance/soldiers';
import { MUTATIONS } from './MutationSystem';
import { isItemAffordable, itemCost, itemKey, type ItemCost } from './NextAction';

export type { CounterMarks } from '../data/balance/combat';

/**
 * Counters (Story 4.2, FR9, FR10, FR12): every weapon and armor level and
 * every mutation is strong against some enemy traits and weak against others
 * (`combatBalance.equipment` / `combatBalance.mutations`). The battle summary
 * (Story 4.3) names a cause and points at the card that answers it.
 */

/** One upgrade: a level of a piece of equipment (1 to max), or a mutation. */
export type Upgrade =
  | { readonly kind: 'equipment'; readonly id: 'weapon' | 'armor'; readonly level: number }
  | { readonly kind: 'mutation'; readonly id: string };

const NO_MARKS: CounterMarks = { strongAgainst: [], weakAgainst: [] };

/** What an upgrade is strong and weak against. An unknown mutation or a level past the last has no marks. */
export function marksOf(u: Upgrade): CounterMarks {
  if (u.kind === 'equipment') {
    const level: CounterMarks | undefined = combatBalance.equipment[u.id][u.level - 1];
    return level ?? NO_MARKS;
  }
  const m = (combatBalance.mutations as Readonly<Record<string, CounterMarks>>)[u.id];
  return m ?? NO_MARKS;
}

/** The upgrade a WAR card sells in this state: a mutation, or the next level of a piece of equipment. */
export function upgradeOf(ref: ItemRef, state: GameState): Upgrade {
  if (ref.kind === 'equipment') return { kind: 'equipment', id: ref.id, level: state.equipment[ref.id] + 1 };
  if (ref.kind === 'mutation') return { kind: 'mutation', id: ref.id };
  // Only WAR's cards counter anything; others have no marks.
  return { kind: 'mutation', id: '' };
}

/**
 * Why a battle went the way it did (Story 4.3 emits it with `battle_completed`),
 * always with the enemy's trait, since the answer depends on what was faced.
 * - `trait_beat_mutation`: the trait blunted a mutation (`THEIR SHELLS TURNED YOUR VENOM.`).
 * - `trait_beat_equipment`: the trait blunted the equipment (a swarm's cap on sharper weapons).
 * - `outnumbered`: too few soldiers for the enemy.
 * - `equipment_gap`: the equipment fell short of the enemy.
 * Story 4.3 may add kinds; `counterFor` answers any kind from its trait.
 */
export type BattleCauseKind = 'trait_beat_mutation' | 'trait_beat_equipment' | 'outnumbered' | 'equipment_gap';
export interface BattleCause {
  readonly kind: BattleCauseKind;
  readonly trait: TraitId;
}

/** A counter card: the item, its price now, and whether the player can buy it now. */
export interface CounterCard {
  readonly ref: ItemRef;
  /** `itemKey(ref)`: `mutation:tough_shells`, `equipment:armor`. */
  readonly key: string;
  readonly cost: ItemCost;
  readonly affordable: boolean;
}

/** The WAR cards that can counter a trait, in the order ties go to. */
const COUNTER_CARDS: readonly ItemRef[] = [
  { kind: 'equipment', id: 'weapon' },
  { kind: 'equipment', id: 'armor' },
  ...MUTATIONS.map((m): ItemRef => ({ kind: 'mutation', id: m.id })),
];

const units = (cost: ItemCost): number => Object.values(cost).reduce((sum: number, n) => sum + (n ?? 0), 0);

/**
 * The cheapest card the player holds or can buy that is strong against the
 * cause's trait (Story 4.2, for Story 4.3's `> CHANGE → <card>`): equipment
 * whose workshop stands and is below its last level, or a mutation not yet
 * owned whose prerequisite is. It may be unaffordable (the summary then shows
 * the shortfall). An equipment gap is answered by equipment. Null when no
 * such card is open. Pure.
 */
export function counterFor(cause: BattleCause, state: GameState): CounterCard | null {
  let best: CounterCard | null = null;
  for (const ref of COUNTER_CARDS) {
    if (cause.kind === 'equipment_gap' && ref.kind !== 'equipment') continue;
    if (ref.kind === 'equipment' && state.equipment[ref.id] >= soldierBalance.maxEquipmentLevel) continue;
    const cost = itemCost(state, ref);
    if (cost === null) continue;
    if (!marksOf(upgradeOf(ref, state)).strongAgainst.includes(cause.trait)) continue;
    if (best === null || units(cost) < units(best.cost)) {
      best = { ref, key: itemKey(ref), cost, affordable: isItemAffordable(state, ref) };
    }
  }
  return best;
}
