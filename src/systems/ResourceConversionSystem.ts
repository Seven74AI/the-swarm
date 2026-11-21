import type { GameState, ConversionState } from '../state/GameState';
import type { ResearchProjectId } from '../state/GameState';
import { isProjectCompleted } from './ResearchSystem';
import { conversionBalance as C } from '../data/balance/conversions';
import { PANEL_PLACEMENT, isUnlocked } from '../data/content/tabs';
import type { Phase } from '../phases/phases';

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
 * Three-step resource conversion DAG (amounts and caps in `data/balance/conversions.ts`):
 *   stone + nectar + researchers → voidCrystals
 *   voidCrystals + particleLab → antimatter
 *   antimatter + spaceExpedition → darkMatter
 */
const CONVERSIONS: ConversionDef[] = [
  {
    id: 'voidCrystalSynthesis',
    name: 'Void Crystal Synthesis',
    inputs: { ...C.voidCrystalSynthesis.inputs },
    outputs: { ...C.voidCrystalSynthesis.outputs },
    requiredResearch: 'voidCrystalSynthesis',
    baseRate: 1,
    /** Rate cap: one run a second per `researchersPerRun` researchers assigned. */
    getRateCap: (state: GameState): number => {
      const researchers = state.workersAssigned.researchers ?? 0;
      return Math.floor(researchers / C.voidCrystalSynthesis.researchersPerRun);
    },
    isReady: (): boolean => true,
  },
  {
    id: 'antimatterContainment',
    name: 'Antimatter Containment',
    inputs: { ...C.antimatterContainment.inputs },
    outputs: { ...C.antimatterContainment.outputs },
    requiredResearch: 'antimatterContainment',
    baseRate: 1,
    /** Rate cap: runs a second for each Particle Lab level (Story 3.6: Lv.1 already runs). */
    getRateCap: (state: GameState): number => {
      const lab = state.conversions?.particleLab ?? 0;
      return lab * C.antimatterContainment.runsPerSecPerLabLevel;
    },
    isReady: (state: GameState): boolean => {
      return (state.conversions?.particleLab ?? 0) > 0;
    },
  },
  {
    id: 'darkMatterDetection',
    name: 'Dark Matter Detection',
    inputs: { ...C.darkMatterDetection.inputs },
    outputs: { ...C.darkMatterDetection.outputs },
    requiredResearch: 'darkMatterDetection',
    baseRate: 1,
    /** Rate cap: one run a second per `explorationsPerRun` active space explorations. */
    getRateCap: (state: GameState): number => {
      return Math.floor((state.spaceExplorations?.length ?? 0) / C.darkMatterDetection.explorationsPerRun);
    },
    isReady: (state: GameState): boolean => {
      return (state.spaceExplorations?.length ?? 0) > 0;
    },
  },
];

const NO_REMAINDER: Record<ConversionId, number> = {
  voidCrystalSynthesis: 0,
  antimatterContainment: 0,
  darkMatterDetection: 0,
};

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

/** The stocks a Particle Lab level is paid from. */
export type ParticleLabCost = { readonly stone: number; readonly voidCrystals: number };

/** Price of the Particle Lab's next level from `level` (0 = build it): `floor(base × multiplier^level)`. */
export function getParticleLabCost(level: number): ParticleLabCost {
  const { baseCost, costMultiplier } = C.particleLab;
  const growth = Math.pow(costMultiplier, level);
  return { stone: Math.floor(baseCost.stone * growth), voidCrystals: Math.floor(baseCost.voidCrystals * growth) };
}

/** Whether BUILD sells the Particle Lab in this state: with the converter (Story 3.6). */
export function isParticleLabOpen(state: GameState): boolean {
  return isUnlocked(PANEL_PLACEMENT.resource_converter_panel.unlockPhase, state.phase as Phase);
}

/** Whether the stocks cover the Particle Lab's next level (affordability only). */
export function canAffordParticleLab(state: GameState): boolean {
  const cost = getParticleLabCost(state.conversions.particleLab);
  return state.resources.stone >= cost.stone && state.resources.voidCrystals >= cost.voidCrystals;
}

/** Whether the Particle Lab's next level can be bought now. */
export function canBuildParticleLab(state: GameState): boolean {
  return isParticleLabOpen(state) && canAffordParticleLab(state);
}

/**
 * Build the Particle Lab, or its next level, and pay for it (Story 3.6). The
 * same state when it isn't on sale or the stocks fall short.
 */
export function buildParticleLab(state: GameState): GameState {
  if (!canBuildParticleLab(state)) return state;
  const cost = getParticleLabCost(state.conversions.particleLab);
  return {
    ...state,
    resources: {
      ...state.resources,
      stone: state.resources.stone - cost.stone,
      voidCrystals: state.resources.voidCrystals - cost.voidCrystals,
    },
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
  const remainder = { ...NO_REMAINDER, ...state.conversions.remainder };

  for (const def of CONVERSIONS) {
    // Runs a second while unlocked and staffed; inputs are checked per run below.
    const rate = isConversionUnlocked(state, def.id) ? def.getRateCap(state) : 0;
    if (rate <= 0) {
      // A stopped conversion keeps no progress: it restarts from zero.
      remainder[def.id] = 0;
      continue;
    }

    // How many conversions can run this step? The fraction carries to the next
    // step (Story 2.5), so a rate under one run a tick still runs. Whole runs
    // the inputs can't pay for are dropped, not banked.
    const progress = remainder[def.id] + rate * dtSec;
    const maxConversions = Math.floor(progress);
    remainder[def.id] = progress - maxConversions;

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

  result = { ...result, conversions: { ...state.conversions, remainder } };

  // Clamp all resources >= 0
  for (const key of Object.keys(result.resources) as Array<keyof GameState['resources']>) {
    if (result.resources[key] < 0) {
      (result.resources as Record<string, number>)[key] = 0;
    }
  }

  return result;
}
