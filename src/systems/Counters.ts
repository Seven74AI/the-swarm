import type { GameState } from '../state/GameState';
import type { TraitId } from '../data/content/enemies';
import type { ItemRef } from '../data/content/criticalPath';
import { combatBalance, type CounterMarks } from '../data/balance/combat';
import { soldierBalance } from '../data/balance/soldiers';
import { MUTATIONS } from './MutationSystem';
import { isItemAffordable, itemCost, itemKey, itemTarget, type ItemCost } from './NextAction';

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
 * Why a battle went the way it did (Story 4.3 emits it with `battle_completed`;
 * `systems/BattleCauses.ts` decides it), always with the enemy's trait, since
 * the answer depends on what was faced.
 * - `trait_beat_mutation`: the trait blunted a mutation (`THEIR SHELLS TURNED YOUR VENOM.`).
 * - `trait_beat_equipment`: the trait blunted the equipment (a swarm's cap on sharper weapons).
 * - `outnumbered`: too few soldiers for the enemy.
 * - `equipment_gap`: the equipment fell short of the enemy.
 * - `trait_countered` (a victory): an owned counter answered the trait.
 * - `outfought` (a victory): the army won on its own weight.
 * `counterFor` answers any kind from its trait.
 */
export type BattleCauseKind =
  | 'trait_beat_mutation'
  | 'trait_beat_equipment'
  | 'outnumbered'
  | 'equipment_gap'
  | 'trait_countered'
  | 'outfought';

/** The upgrade a cause names: a piece of equipment or a mutation id. */
export type CauseUpgrade = 'weapon' | 'armor' | (string & {});

export interface BattleCause {
  readonly kind: BattleCauseKind;
  readonly trait: TraitId;
  /** The mutation or equipment the cause line names (blunted, short, or the counter that held). */
  readonly upgrade?: CauseUpgrade;
}

/** A counter card: the item, its price now, and whether the player can buy it now. */
export interface CounterCard {
  readonly ref: ItemRef;
  /** `itemKey(ref)`: `mutation:tough_shells`, `equipment:armor`. */
  readonly key: string;
  readonly cost: ItemCost;
  readonly affordable: boolean;
  /** The card as its button names it: `TOUGH SHELLS`, `ARMOR LV.2`. */
  readonly target: string;
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
  return cheapestCounter(cause, state, false);
}

function cheapestCounter(cause: BattleCause, state: GameState, payableOnly: boolean): CounterCard | null {
  let best: CounterCard | null = null;
  for (const ref of COUNTER_CARDS) {
    if (cause.kind === 'equipment_gap' && ref.kind !== 'equipment') continue;
    if (ref.kind === 'equipment' && state.equipment[ref.id] >= soldierBalance.maxEquipmentLevel) continue;
    const cost = itemCost(state, ref);
    if (cost === null) continue;
    if (!marksOf(upgradeOf(ref, state)).strongAgainst.includes(cause.trait)) continue;
    const affordable = isItemAffordable(state, ref);
    if (payableOnly && !affordable) continue;
    if (best === null || units(cost) < units(best.cost)) {
      best = { ref, key: itemKey(ref), cost, affordable, target: itemTarget(state, ref) };
    }
  }
  return best;
}

/** What a counter card still needs: the first stock short of its price. */
export interface CounterShortfall {
  /** The stock (`chitin`, `silk`, `venom`, or a colony resource). */
  readonly resource: string;
  /** Whole units still needed. */
  readonly amount: number;
}

/**
 * The battle summary's advice (Story 4.3, UX-DR25): the card `counterFor`
 * returns; when the colony cannot pay for it, what it still needs and,
 * if one exists, a cheaper counter it can pay for now (the cheapest such card,
 * same rules as `counterFor`). Pure.
 */
export interface BattleAdvice {
  readonly counter: CounterCard | null;
  readonly shortfall: CounterShortfall | null;
  readonly alternative: CounterCard | null;
}

function stockOf(state: GameState, key: string): number {
  const combat = state.combatResources as unknown as Readonly<Record<string, number | undefined>>;
  const colony = state.resources as unknown as Readonly<Record<string, number | undefined>>;
  return Math.floor(combat[key] ?? colony[key] ?? 0);
}

export function battleAdvice(cause: BattleCause, state: GameState): BattleAdvice {
  const counter = counterFor(cause, state);
  if (counter === null || counter.affordable) return { counter, shortfall: null, alternative: null };
  let shortfall: CounterShortfall | null = null;
  for (const [resource, price] of Object.entries(counter.cost)) {
    const amount = Math.floor((price ?? 0) - stockOf(state, resource));
    if (amount > 0) {
      shortfall = { resource, amount };
      break;
    }
  }
  const alternative = cheapestCounter(cause, state, true);
  return { counter, shortfall, alternative: alternative?.key === counter.key ? null : alternative };
}
