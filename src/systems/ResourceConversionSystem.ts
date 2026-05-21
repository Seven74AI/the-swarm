import type { GameState, ConversionState } from '../state/GameState';
import type { ResearchProjectId } from '../state/GameState';
import { isProjectCompleted } from './ResearchSystem';

/**
 * Resource conversion chain IDs — matches ResearchProjectId for unlock linkage.
 */
export type ConversionId = 'voidCrystalSynthesis' | 'antimatterContainment' | 'darkMatterDetection';

/**
 * A single resource conversion step in the DAG.
 */
export interface ConversionDef {
  id: ConversionId;
  name: string;
  /** Resources consumed per conversion (per-tick values, scaled by dtSec) */
  inputs: Partial<Record<keyof GameState['resources'], number>>;
  /** Resources produced per conversion */
  outputs: Partial<Record<keyof GameState['resources'], number>>;
  /** Research project that unlocks this conversion */
  requiredResearch: ResearchProjectId;
  /** Base rate (conversions per tick at dtSec=1) */
  baseRate: number;
  /** Rate cap as a function of game state */
  getRateCap: (state: GameState) => number;
  /** Additional readiness check beyond research completion */
  isReady: (state: GameState) => boolean;
}

/**
 * Three-step resource conversion DAG:
 *   stone + nectar + researchers → voidCrystals
 *   voidCrystals + particleLab → antimatter
 *   antimatter + spaceExpedition → darkMatter
 */
const CONVERSIONS: ConversionDef[] = [
  {
    id: 'voidCrystalSynthesis',
    name: 'Void Crystal Synthesis',
    inputs: { stone: 5, nectar: 2 },
    outputs: { voidCrystals: 1 },
    requiredResearch: 'voidCrystalSynthesis',
    baseRate: 1,
    /** Rate cap: 1 per 5 researchers assigned per tick */
    getRateCap: (state: GameState): number => {
      const researchers = state.workersAssigned.researchers ?? 0;
      return Math.floor(researchers / 5);
    },
    isReady: (): boolean => true,
  },
  {
    id: 'antimatterContainment',
    name: 'Antimatter Containment',
    inputs: { voidCrystals: 2 },
    outputs: { antimatter: 1 },
    requiredResearch: 'antimatterContainment',
    baseRate: 1,
    /** Rate cap: particleLab level * 1 per tick */
    getRateCap: (state: GameState): number => {
      const lab = state.conversions?.particleLab ?? 0;
      return lab;
    },
    isReady: (state: GameState): boolean => {
      return (state.conversions?.particleLab ?? 0) > 0;
    },
  },
  {
    id: 'darkMatterDetection',
    name: 'Dark Matter Detection',
    inputs: { antimatter: 1 },
    outputs: { darkMatter: 1 },
    requiredResearch: 'darkMatterDetection',
    baseRate: 1,
    /** Rate cap: 1 per active space exploration */
    getRateCap: (state: GameState): number => {
      return state.spaceExplorations?.length ?? 0;
    },
    isReady: (state: GameState): boolean => {
      return (state.spaceExplorations?.length ?? 0) > 0;
    },
  },
];

/** Get all conversion definitions in DAG order. */
export function getConversionDefs(): ConversionDef[] {
  return CONVERSIONS;
}

/**
 * Check if a conversion is unlocked and ready to run.
 */
export function isConversionUnlocked(state: GameState, id: ConversionId): boolean {
  const def = CONVERSIONS.find((c) => c.id === id);
  if (!def) return false;

  // Research must be completed
  if (!isProjectCompleted(state, def.requiredResearch)) return false;

  // Additional readiness check
  if (!def.isReady(state)) return false;

  return true;
}

/**
 * Get the effective rate for a conversion (0 if not unlocked or capped at 0).
 */
export function getConversionRate(state: GameState, id: ConversionId): number {
  if (!isConversionUnlocked(state, id)) return 0;

  const def = CONVERSIONS.find((c) => c.id === id)!;
  const cap = def.getRateCap(state);
  if (cap <= 0) return 0;

  // Check if we have enough input resources for at least 1 conversion
  for (const [resource, amount] of Object.entries(def.inputs)) {
    const key = resource as keyof GameState['resources'];
    if ((state.resources[key] as number) < (amount as number)) {
      return 0;
    }
  }

  return cap;
}

/**
 * Build a particle lab (increment level).
 */
export function buildParticleLab(state: GameState): GameState {
  if (!state.conversions) return state;

  return {
    ...state,
    conversions: {
      ...state.conversions,
      particleLab: state.conversions.particleLab + 1,
    },
  };
}

/**
 * Tick all resource conversions. Runs unlocked conversions in DAG order,
 * consuming inputs and producing outputs. O(1) per tick.
 *
 * Conversions run sequentially in DAG order so that voidCrystals produced
 * in step 1 are available for antimatter production in step 2.
 *
 * @param state Current game state (not mutated)
 * @param dtSec Delta time in seconds (default 1 for tick-at-a-time)
 * @returns New game state with conversion deltas applied
 */
export function tickConversions(state: GameState, dtSec: number = 1): GameState {
  if (!state.conversions) return state;

  let result: GameState = { ...state };
  const resources = { ...result.resources };

  for (const def of CONVERSIONS) {
    const rate = getConversionRate(state, def.id);
    if (rate <= 0) continue;

    // How many conversions can run this tick?
    const maxConversions = Math.floor(rate * dtSec);

    // Determine actual conversions by checking input availability
    let actualConversions = 0;
    for (let i = 0; i < maxConversions; i++) {
      let canConvert = true;
      for (const [resource, amount] of Object.entries(def.inputs)) {
        const key = resource as keyof GameState['resources'];
        const needed = (amount as number) * (i + 1);
        if ((resources[key] as number) < needed) {
          canConvert = false;
          break;
        }
      }
      if (!canConvert) break;
      actualConversions = i + 1;
    }

    if (actualConversions <= 0) continue;

    // Consume inputs
    for (const [resource, perUnit] of Object.entries(def.inputs)) {
      const key = resource as keyof GameState['resources'];
      const consumed = (perUnit as number) * actualConversions;
      (resources as Record<string, number>)[resource] = (resources[key] as number) - consumed;
    }

    // Produce outputs
    for (const [resource, perUnit] of Object.entries(def.outputs)) {
      const key = resource as keyof GameState['resources'];
      const produced = (perUnit as number) * actualConversions;
      (resources as Record<string, number>)[resource] =
        Math.floor((resources[key] as number) + produced);
    }

    // Update state for next conversion in DAG (so voidCrystals are available immediately)
    result = {
      ...result,
      resources: { ...resources },
    };
    // Also update the state ref used by getConversionRate (but inputs check uses `resources`)
    state = result;
  }

  // Clamp all resources >= 0
  for (const key of Object.keys(result.resources) as Array<keyof GameState['resources']>) {
    if (result.resources[key] < 0) {
      (result.resources as Record<string, number>)[key] = 0;
    }
  }

  return result;
}
