import type { GameState, Mutation as MutationState } from '../state/GameState';
import { mutationBalance } from '../data/balance/mutations';
import { PERCENT } from '../data/constants';

/**
 * Mutation bonus effect values.
 * All values are additive bonuses applied after base calculations.
 */
export interface MutationEffects {
  /** Multiplier on gather rate (0.0 = no bonus, 0.10 = +10%) */
  gatherRate: number;
  /** Flat bonus to soldier speed */
  speed: number;
  /** Multiplier on larva hatch rate (0.0 = no bonus, 0.20 = +20%) */
  hatchRate: number;
  /** Flat bonus to soldier max HP */
  maxHp: number;
  /** Multiplier on poison/venom DoT damage (0.0 = no bonus, 0.50 = +50%) */
  poisonDamage: number;
  /** Flat bonus to soldier strength */
  strength: number;
}

/**
 * Cost for purchasing a mutation.
 * Only combat resources are used — no food/wood/stone/nectar.
 */
export interface MutationCost {
  chitin: number;
  silk: number;
  venom: number;
}

/** A mutation definition in the registry. */
export interface MutationDef {
  id: string;
  name: string;
  /** Short description of the bonus effect */
  description: string;
  cost: MutationCost;
  /** ID of prerequisite mutation (null if none) */
  prerequisite: string | null;
  /** Partial effects — only the fields this mutation modifies */
  effects: Partial<MutationEffects>;
}

/** A share as whole percentage points, for the descriptions. */
const pct = (share: number): number => Math.round(share * PERCENT);

/** Registry of all available mutations. */
export const MUTATIONS: MutationDef[] = [
  {
    id: 'efficient_gatherers',
    name: 'Efficient Gatherers',
    description: `+${pct(mutationBalance.efficient_gatherers.effects.gatherShare)}% gather rate`,
    cost: { ...mutationBalance.efficient_gatherers.cost },
    prerequisite: null,
    effects: { gatherRate: mutationBalance.efficient_gatherers.effects.gatherShare },
  },
  {
    id: 'swift_soldiers',
    name: 'Swift Soldiers',
    description: `+${mutationBalance.swift_soldiers.effects.speed} soldier speed`,
    cost: { ...mutationBalance.swift_soldiers.cost },
    prerequisite: null,
    effects: { ...mutationBalance.swift_soldiers.effects },
  },
  {
    id: 'accelerated_hatching',
    name: 'Accelerated Hatching',
    description: `Larvae hatch ${pct(mutationBalance.accelerated_hatching.effects.hatchShare)}% faster`,
    cost: { ...mutationBalance.accelerated_hatching.cost },
    prerequisite: null,
    effects: { hatchRate: mutationBalance.accelerated_hatching.effects.hatchShare },
  },
  {
    id: 'tough_shells',
    name: 'Tough Shells',
    description: `+${mutationBalance.tough_shells.effects.maxHp} soldier max HP`,
    cost: { ...mutationBalance.tough_shells.cost },
    prerequisite: null,
    effects: { ...mutationBalance.tough_shells.effects },
  },
  {
    id: 'potent_venom',
    name: 'Potent Venom',
    description: `+${pct(mutationBalance.potent_venom.effects.poisonDamage)}% poison DoT damage`,
    cost: { ...mutationBalance.potent_venom.cost },
    prerequisite: 'accelerated_hatching',
    effects: { ...mutationBalance.potent_venom.effects },
  },
  {
    id: 'reinforced_mandibles',
    name: 'Reinforced Mandibles',
    description: `+${mutationBalance.reinforced_mandibles.effects.strength} soldier strength`,
    cost: { ...mutationBalance.reinforced_mandibles.cost },
    prerequisite: 'swift_soldiers',
    effects: { ...mutationBalance.reinforced_mandibles.effects },
  },
];

/** Lookup map for O(1) mutation access by ID. */
const MUTATION_MAP: Map<string, MutationDef> = new Map(
  MUTATIONS.map((m) => [m.id, m]),
);

/**
 * Check if a player can afford a mutation.
 * Returns true if the mutation exists, is not already purchased,
 * its prerequisite is met, and the player has enough combat resources.
 */
export function canPurchaseMutation(state: GameState, mutationId: string): boolean {
  const def = MUTATION_MAP.get(mutationId);
  if (!def) return false;

  // Already purchased?
  const existing = state.mutations.find((m) => m.id === mutationId);
  if (existing?.purchased) return false;

  // Prerequisite check
  if (def.prerequisite) {
    const prereq = state.mutations.find((m) => m.id === def.prerequisite);
    if (!prereq?.purchased) return false;
  }

  // Cost check
  const cr = state.combatResources;
  return cr.chitin >= def.cost.chitin
    && cr.silk >= def.cost.silk
    && cr.venom >= def.cost.venom;
}

/**
 * Purchase a mutation. Returns a new state with the mutation marked purchased
 * and combat resources deducted. Returns the same state reference if the
 * purchase is invalid (already owned, missing prerequisite, insufficient resources).
 */
export function purchaseMutation(state: GameState, mutationId: string): GameState {
  const def = MUTATION_MAP.get(mutationId);
  if (!def) return state;

  // Check already purchased
  const existing = state.mutations.find((m) => m.id === mutationId);
  if (existing?.purchased) return state;

  // Prerequisite check
  if (def.prerequisite) {
    const prereq = state.mutations.find((m) => m.id === def.prerequisite);
    if (!prereq?.purchased) return state;
  }

  // Cost check
  const cr = state.combatResources;
  if (cr.chitin < def.cost.chitin || cr.silk < def.cost.silk || cr.venom < def.cost.venom) {
    return state;
  }

  // Update mutations array
  const mutations = state.mutations.map((m) =>
    m.id === mutationId ? { ...m, purchased: true } : m,
  );

  return {
    ...state,
    mutations,
    combatResources: {
      chitin: cr.chitin - def.cost.chitin,
      silk: cr.silk - def.cost.silk,
      venom: cr.venom - def.cost.venom,
    },
  };
}

/**
 * Aggregate effects from all purchased mutations into a single effects object.
 * Returns zeroed effects when no mutations are purchased.
 */
export function getMutationEffects(state: GameState): MutationEffects {
  const effects: MutationEffects = {
    gatherRate: 0,
    speed: 0,
    hatchRate: 0,
    maxHp: 0,
    poisonDamage: 0,
    strength: 0,
  };

  for (const m of state.mutations) {
    if (!m.purchased) continue;
    const def = MUTATION_MAP.get(m.id);
    if (!def) continue;

    for (const [key, value] of Object.entries(def.effects)) {
      const k = key as keyof MutationEffects;
      effects[k] += value as number;
    }
  }

  return effects;
}

/**
 * Check if all prerequisites for a mutation are met.
 * Returns true if the mutation has no prerequisite or its prerequisite is purchased.
 */
export function isMutationUnlocked(state: GameState, mutationId: string): boolean {
  const def = MUTATION_MAP.get(mutationId);
  if (!def) return false;

  if (!def.prerequisite) return true;

  const prereq = state.mutations.find((m) => m.id === def.prerequisite);
  return prereq?.purchased === true;
}

/**
 * Get the cost of a mutation. Returns zeroed cost if mutation not found.
 */
export function getMutationCost(mutationId: string): MutationCost {
  const def = MUTATION_MAP.get(mutationId);
  return def?.cost ?? { chitin: 0, silk: 0, venom: 0 };
}

/**
 * Get a mutation definition by ID.
 */
export function getMutationDef(mutationId: string): MutationDef | undefined {
  return MUTATION_MAP.get(mutationId);
}
