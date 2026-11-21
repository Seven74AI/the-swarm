import { Phase } from '../../phases/phases';
import type { BuildingType } from '../../systems/BuildingSystem';
import type { AutomationBuildingType, ResearchType } from '../../systems/AutomationSystem';
import type { ResearchProjectId } from '../../state/GameState';
import type { UpgradeId } from '../balance/upgrades';

/**
 * Something the player can buy, as the next-action rule names it (Story 1.21).
 * `systems/NextAction.ts` knows what each costs, which panel sells it and which
 * action buys it.
 */
export type ItemRef =
  | { readonly kind: 'upgrade'; readonly id: UpgradeId }
  | { readonly kind: 'building'; readonly id: BuildingType }
  | { readonly kind: 'mutation'; readonly id: string }
  | { readonly kind: 'equipment'; readonly id: 'weapon' | 'armor' }
  | { readonly kind: 'ship' }
  | { readonly kind: 'particle_lab' }
  | { readonly kind: 'research'; readonly id: ResearchProjectId }
  | { readonly kind: 'auto_research'; readonly id: ResearchType }
  | { readonly kind: 'auto_building'; readonly id: AutomationBuildingType };

/**
 * The critical path of each phase (Story 1.21, UX-DR12; E4 content, arch D7):
 * the items the next-action rule prefers, in order, when more than one is
 * affordable. Each serves the phase's goal; anything not listed can still be
 * suggested by the "any affordable item" rule. Data, never code paths: the rule
 * never names an item itself.
 *
 * Every entry must be sold by a panel that is open in its phase
 * (`data/content/tabs.ts`), which `tests/unit/data/criticalPath.test.ts` checks.
 */
export const CRITICAL_PATH: Readonly<Record<Phase, readonly ItemRef[]>> = {
  // Workers come from eggs: more eggs per tap first, then a faster hatch, more food, more rooms (Story 4.6).
  [Phase.EGG_LAYING]: [
    { kind: 'upgrade', id: 'click_power' },
    { kind: 'upgrade', id: 'warm_brood' },
    { kind: 'upgrade', id: 'lean_rations' },
    { kind: 'upgrade', id: 'side_chamber' },
  ],
  // Colony grows workers into its rooms (Story 4.7): room first (the Warehouse at once, Tunnels
  // over time), then food for the bigger colony. Tapping still lays every egg until automation
  // does (Story 4.10), then time away counts for more. Barracks and Walls pay off only beyond
  // the nest, so they come last.
  [Phase.COLONY]: [
    { kind: 'building', id: 'warehouse' },
    { kind: 'building', id: 'tunnels' },
    { kind: 'building', id: 'fungus_garden' },
    { kind: 'upgrade', id: 'click_power' },
    { kind: 'research', id: 'dormantForaging' },
    { kind: 'building', id: 'barracks' },
    { kind: 'building', id: 'walls' },
  ],
  // Battles won (Story 4.8): every equipment, mutation and combat building
  // competes here for the loot. Army-wide stats first (a workshop, then its
  // equipment), then the mutations that answer one trait each, then venom.
  [Phase.COMBAT]: [
    { kind: 'building', id: 'chitin_armory' },
    { kind: 'equipment', id: 'weapon' },
    { kind: 'building', id: 'silk_weaving' },
    { kind: 'equipment', id: 'armor' },
    { kind: 'mutation', id: 'tough_shells' },
    { kind: 'mutation', id: 'swift_soldiers' },
    { kind: 'mutation', id: 'reinforced_mandibles' },
    { kind: 'mutation', id: 'efficient_gatherers' },
    { kind: 'mutation', id: 'accelerated_hatching' },
    { kind: 'building', id: 'venom_lab' },
    { kind: 'mutation', id: 'potent_venom' },
    // Last: the fallen's chitin feeds everything above, paid in the army's food.
    { kind: 'building', id: 'midden' },
  ],
  // Workers and a food stock: room for workers, expeditions for territory, more food.
  [Phase.EXPANSION]: [
    { kind: 'building', id: 'warehouse' },
    { kind: 'building', id: 'barracks' },
    { kind: 'mutation', id: 'efficient_gatherers' },
  ],
  // Void crystals, antimatter and dark matter: the research chain and the ship.
  [Phase.SPACE]: [
    { kind: 'research', id: 'voidCrystalSynthesis' },
    { kind: 'research', id: 'antimatterContainment' },
    { kind: 'research', id: 'darkMatterDetection' },
    { kind: 'ship' },
  ],
  // The automation tree, in unlock order.
  [Phase.TRANSCENDENCE]: [
    { kind: 'auto_research', id: 'basic_incubation' },
    { kind: 'auto_research', id: 'queens_pheromones' },
    { kind: 'auto_research', id: 'thermal_regulation' },
    { kind: 'auto_building', id: 'nursery' },
  ],
};
