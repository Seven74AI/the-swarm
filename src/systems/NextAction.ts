import type { GameState, ResearchProjectId } from '../state/GameState';
import { Phase, PHASE_ORDER } from '../phases/phases';
import { CRITICAL_PATH, type ItemRef } from '../data/content/criticalPath';
import { PANEL_PLACEMENT, isUnlocked, type PanelId } from '../data/content/tabs';
import { nextActionBalance } from '../data/balance/nextAction';
import { canBuild, getBuildCost, getEffects, type BuildingType } from './BuildingSystem';
import { computeResourceRates, getAssignedWorkers, getUpgradeCost, type WorkerRole } from './ResourceSystem';
import { TerritorySystem } from './TerritorySystem';
import { MUTATIONS, canPurchaseMutation } from './MutationSystem';
import { MAX_EQUIPMENT_LEVEL, getEquipmentUpgradeCost } from './SoldierSystem';
import { MAX_SHIP_LEVEL, canAffordShipCost, getShipCost } from './SpaceshipSystem';
import { canStartProject, getAssignedResearchers, getProjectStatus, getProjects } from './ResearchSystem';
import {
  AUTOMATION_BUILDINGS,
  RESEARCHES,
  canBuildAuto,
  canResearch,
  getAutoBuildCost,
  type AutomationBuildingType,
  type ResearchType,
} from './AutomationSystem';

export type { ItemRef } from '../data/content/criticalPath';

/**
 * One player intent, named after the action in `actions/` that performs it
 * (`actions.perform(intent)`). The next-action rule only suggests intents
 * that action would accept now.
 */
export type ActionIntent =
  | { readonly action: 'continuePhase' }
  | { readonly action: 'assignWorker' | 'unassignWorker'; readonly role: WorkerRole }
  | { readonly action: 'buyUpgrade'; readonly id: string }
  | { readonly action: 'buyBuilding'; readonly id: BuildingType }
  | { readonly action: 'buyMutation'; readonly id: string }
  | { readonly action: 'upgradeWeapon' | 'upgradeArmor' | 'buildShip' | 'upgradeShip' }
  | { readonly action: 'startResearch'; readonly id: ResearchProjectId }
  | { readonly action: 'researchAutomation'; readonly id: ResearchType }
  | { readonly action: 'buildAutomation'; readonly id: AutomationBuildingType };

/** Which rule chose the suggestion (first match wins, in this order). */
export type NextActionRule = 'goal' | 'food' | 'capacity' | 'critical_path' | 'affordable';

/** A suggestion: one button's verb, target and intent. */
export interface SuggestedAction {
  readonly kind: 'act';
  readonly rule: NextActionRule;
  /** Stable identity of the target (`building:warehouse`, `assignWorker:gather`, `continue`). */
  readonly key: string;
  readonly verb: string;
  readonly target?: string;
  readonly intent: ActionIntent;
  /** The panel that holds the target (the offline summary opens its tab). */
  readonly panel: PanelId;
}

/** No suggestion: what becomes affordable next, and in how many whole seconds at the current rates. */
export interface NoAction {
  readonly kind: 'none';
  readonly key: string;
  readonly nextAffordable: { readonly key: string; readonly name: string; readonly inSec: number } | null;
}

export type NextAction = SuggestedAction | NoAction;

/** Stock names an item can cost: the colony's resources and the combat resources. */
type CostKey = keyof GameState['resources'] | keyof GameState['combatResources'];
export type ItemCost = Partial<Record<CostKey, number>>;

interface ItemDef {
  readonly panel: PanelId;
  readonly name: string;
  /** Everything but the price: unlocked, not maxed or owned, prerequisites met. */
  readonly open: (s: GameState) => boolean;
  readonly cost: (s: GameState) => ItemCost;
  /** The system's own check, the one the action uses. */
  readonly affordable: (s: GameState) => boolean;
  readonly verb: (s: GameState) => string;
  readonly target: (s: GameState) => string;
  readonly intent: (s: GameState) => ActionIntent;
}

const upper = (x: string): string => x.toUpperCase();
const titled = (id: string): string => id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

function nonZero(cost: Record<string, number | undefined>): ItemCost {
  const out: ItemCost = {};
  for (const [k, v] of Object.entries(cost)) if (v !== undefined && v > 0) out[k as CostKey] = v;
  return out;
}

function stock(s: GameState, k: CostKey): number {
  return k in s.combatResources
    ? s.combatResources[k as keyof GameState['combatResources']]
    : s.resources[k as keyof GameState['resources']];
}

function defOf(ref: ItemRef): ItemDef {
  switch (ref.kind) {
    case 'upgrade': {
      const level = (s: GameState) => s.upgrades[ref.id] ?? 0;
      const cost = (s: GameState) => getUpgradeCost(ref.id, level(s)) ?? 0;
      return {
        panel: 'click_button',
        name: titled(ref.id),
        open: () => true,
        cost: (s) => nonZero({ food: cost(s) }),
        affordable: (s) => s.resources.food >= cost(s),
        verb: () => 'BUY',
        target: (s) => `${upper(titled(ref.id))} LV.${level(s) + 1}`,
        intent: () => ({ action: 'buyUpgrade', id: ref.id }),
      };
    }
    case 'building':
      return {
        panel: 'building_panel',
        name: titled(ref.id),
        open: () => true,
        cost: (s) => nonZero({ ...getBuildCost(ref.id, s.buildings[ref.id].level + 1) }),
        affordable: (s) => canBuild(ref.id, s),
        verb: () => 'BUY',
        target: (s) => `${upper(titled(ref.id))} LV.${s.buildings[ref.id].level + 1}`,
        intent: () => ({ action: 'buyBuilding', id: ref.id }),
      };
    case 'mutation': {
      const def = MUTATIONS.find((m) => m.id === ref.id);
      const owned = (s: GameState, id: string) => s.mutations.find((m) => m.id === id)?.purchased === true;
      return {
        panel: 'mutation_panel',
        name: def?.name ?? titled(ref.id),
        open: (s) => !!def && !owned(s, def.id) && (!def.prerequisite || owned(s, def.prerequisite)),
        cost: () => nonZero({ ...def?.cost }),
        affordable: (s) => canPurchaseMutation(s, ref.id),
        verb: () => 'BUY',
        target: () => upper(def?.name ?? titled(ref.id)),
        intent: () => ({ action: 'buyMutation', id: ref.id }),
      };
    }
    case 'equipment': {
      const weapon = ref.id === 'weapon';
      const building: BuildingType = weapon ? 'chitin_armory' : 'silk_weaving';
      const pool = weapon ? 'chitin' : 'silk';
      const level = (s: GameState) => s.equipment[ref.id];
      const cost = (s: GameState): ItemCost => nonZero({ [pool]: getEquipmentUpgradeCost(level(s)) });
      const open = (s: GameState) => level(s) < MAX_EQUIPMENT_LEVEL && (s.buildings[building]?.level ?? 0) >= 1;
      return {
        panel: 'soldier_panel',
        name: weapon ? 'Weapons' : 'Armor',
        open,
        cost,
        affordable: (s) => open(s) && s.combatResources[pool] >= getEquipmentUpgradeCost(level(s)),
        verb: () => 'UPGRADE',
        target: (s) => `${weapon ? 'WEAPONS' : 'ARMOR'} LV.${level(s) + 1}`,
        intent: () => ({ action: weapon ? 'upgradeWeapon' : 'upgradeArmor' }),
      };
    }
    case 'ship': {
      const open = (s: GameState) => s.spaceship.level < MAX_SHIP_LEVEL;
      return {
        panel: 'spaceship_panel',
        name: 'Colony Ship',
        open,
        cost: (s) => nonZero({ ...getShipCost(s.spaceship.level) }),
        affordable: (s) => open(s) && canAffordShipCost(s, getShipCost(s.spaceship.level)),
        verb: (s) => (s.spaceship.level === 0 ? 'BUILD' : 'UPGRADE'),
        target: (s) => (s.spaceship.level === 0 ? 'COLONY SHIP' : `COLONY SHIP LV.${s.spaceship.level + 1}`),
        intent: (s) => ({ action: s.spaceship.level === 0 ? 'buildShip' : 'upgradeShip' }),
      };
    }
    case 'research': {
      const def = getProjects().find((p) => p.id === ref.id);
      return {
        panel: 'research_panel',
        name: def?.name ?? ref.id,
        open: (s) =>
          !!def && getProjectStatus(s, ref.id) === 'available' && getAssignedResearchers(s) >= def.requiredResearchers,
        cost: () => nonZero({ ...def?.cost }),
        affordable: (s) => canStartProject(s, ref.id),
        verb: () => 'START',
        target: () => upper(def?.name ?? ref.id),
        intent: () => ({ action: 'startResearch', id: ref.id }),
      };
    }
    case 'auto_research': {
      const def = RESEARCHES[ref.id];
      return {
        panel: 'automation_panel',
        name: def.name,
        open: (s) => !s.autoProduction.researches[ref.id] && def.prerequisites.every((p) => s.autoProduction.researches[p]),
        cost: () => nonZero({ ...def.cost }),
        affordable: (s) => canResearch(ref.id, s),
        verb: () => 'RESEARCH',
        target: () => upper(def.name),
        intent: () => ({ action: 'researchAutomation', id: ref.id }),
      };
    }
    case 'auto_building': {
      const def = AUTOMATION_BUILDINGS[ref.id];
      const level = (s: GameState) => s.autoProduction.buildings[ref.id] ?? 0;
      return {
        panel: 'automation_panel',
        name: def.name,
        open: (s) => level(s) < def.maxLevel,
        cost: (s) => nonZero({ ...getAutoBuildCost(ref.id, level(s) + 1) }),
        affordable: (s) => canBuildAuto(ref.id, s),
        verb: () => 'BUILD',
        target: (s) => `${upper(def.name)} LV.${level(s) + 1}`,
        intent: () => ({ action: 'buildAutomation', id: ref.id }),
      };
    }
  }
}

/** Stable identity of an item (`building:warehouse`, `ship`). */
export function itemKey(ref: ItemRef): string {
  return 'id' in ref ? `${ref.kind}:${ref.id}` : ref.kind;
}

/** Every item the rule knows, in the order the "any affordable item" rule tries them. */
export function listItems(): ItemRef[] {
  return [
    { kind: 'upgrade', id: 'click_power' },
    ...(Object.keys(RESEARCHES) as ResearchType[]).map((id): ItemRef => ({ kind: 'auto_research', id })),
    ...(Object.keys(AUTOMATION_BUILDINGS) as AutomationBuildingType[]).map((id): ItemRef => ({ kind: 'auto_building', id })),
    ...(['warehouse', 'barracks', 'walls', 'silk_weaving', 'chitin_armory', 'venom_lab'] as const).map(
      (id): ItemRef => ({ kind: 'building', id }),
    ),
    ...MUTATIONS.map((m): ItemRef => ({ kind: 'mutation', id: m.id })),
    { kind: 'equipment', id: 'weapon' },
    { kind: 'equipment', id: 'armor' },
    ...getProjects().map((p): ItemRef => ({ kind: 'research', id: p.id })),
    { kind: 'ship' },
  ];
}

/** The panel that sells an item. */
export function itemPanel(ref: ItemRef): PanelId {
  return defOf(ref).panel;
}

function panelOpen(s: GameState, panel: PanelId): boolean {
  return isUnlocked(PANEL_PLACEMENT[panel].unlockPhase, s.phase as Phase);
}

/** An item's price now (only the stocks it uses), or null when it can't be bought at any price now. */
export function itemCost(s: GameState, ref: ItemRef): ItemCost | null {
  const def = defOf(ref);
  return def.open(s) ? def.cost(s) : null;
}

/** Whether the player can buy the item now, from a panel open in this phase. */
export function isItemAffordable(s: GameState, ref: ItemRef): boolean {
  const def = defOf(ref);
  return panelOpen(s, def.panel) && def.open(s) && def.affordable(s);
}

/**
 * The panel that sells an item in this state. Click Power is a NEST card in
 * Phase 1 and a BUILD card from Phase 2 (Story 1.24, UX-DR18).
 */
function sellerIn(s: GameState, ref: ItemRef): PanelId {
  if (ref.kind === 'upgrade' && s.phase !== Phase.EGG_LAYING) return 'build_click_power';
  return defOf(ref).panel;
}

function suggestItem(s: GameState, ref: ItemRef, rule: NextActionRule): SuggestedAction {
  const def = defOf(ref);
  return { kind: 'act', rule, key: itemKey(ref), verb: def.verb(s), target: def.target(s), intent: def.intent(s), panel: sellerIn(s, ref) };
}

function allocate(rule: NextActionRule, action: 'assignWorker' | 'unassignWorker', role: WorkerRole): SuggestedAction {
  return {
    kind: 'act',
    rule,
    key: `${action}:${role}`,
    verb: action === 'assignWorker' ? 'ASSIGN' : 'UNASSIGN',
    target: upper(role),
    intent: { action, role },
    panel: 'worker_assignment',
  };
}

/** Per-second change of each stock at the current rates (food net of upkeep). */
function ratesPerSec(s: GameState): Partial<Record<CostKey, number>> {
  const r = computeResourceRates(s, new TerritorySystem().getBonuses(s));
  return { food: r.foodProducedPerSec - r.foodConsumedPerSec, wood: r.woodPerSec, stone: r.stonePerSec, nectar: r.nectarPerSec };
}

/** Rule 1: the goal latched on the current phase's goal (the same check CONTINUE makes, Story 1.19). */
function goalPending(s: GameState): boolean {
  const goal = s.phaseGoal;
  if (goal?.latched !== true) return false;
  const i = PHASE_ORDER.indexOf(s.phase as Phase);
  return i >= 0 && i + 1 < PHASE_ORDER.length && goal.phase === PHASE_ORDER[i + 1];
}

const freeWorkers = (s: GameState): number => s.resources.workers - getAssignedWorkers(s);

/** Food is critical: the net rate is below zero and the stock covers less than the upkeep window. */
export function isFoodCritical(s: GameState): boolean {
  const r = computeResourceRates(s, new TerritorySystem().getBonuses(s));
  const net = r.foodProducedPerSec - r.foodConsumedPerSec;
  return net < 0 && s.resources.food < r.foodConsumedPerSec * nextActionBalance.foodCriticalSeconds;
}

/** Capacity is critical: workers fill the effective nest capacity up to the balance percentage. */
export function isCapacityCritical(s: GameState): boolean {
  const cap = s.resources.nestCapacity + (getEffects('warehouse', s.buildings.warehouse.level).nestCapacity ?? 0);
  return cap > 0 && s.resources.workers * 100 >= cap * nextActionBalance.capacityCriticalPercent;
}

/** Whether WRKR (the worker roles) is open in the state's phase. */
export function workersOpen(s: GameState): boolean {
  return panelOpen(s, 'worker_assignment');
}

/** Rule 2: net food below zero and the stock covers less than the upkeep window → move a worker to GATHER. */
function foodFix(s: GameState): SuggestedAction | null {
  if (!panelOpen(s, 'worker_assignment') || !isFoodCritical(s)) return null;
  if (freeWorkers(s) > 0) return allocate('food', 'assignWorker', 'gather');
  const a = s.workersAssigned;
  if (a.tend > 0) return allocate('food', 'unassignWorker', 'tend');
  if (a.dig > 0) return allocate('food', 'unassignWorker', 'dig');
  if (a.guard > nextActionBalance.minGuards) return allocate('food', 'unassignWorker', 'guard');
  return null;
}

/** Rule 3: workers fill the nest → a Warehouse if affordable, else a worker on DIG. */
function capacityFix(s: GameState): SuggestedAction | null {
  if (!isCapacityCritical(s)) return null;
  const warehouse: ItemRef = { kind: 'building', id: 'warehouse' };
  if (isItemAffordable(s, warehouse)) return suggestItem(s, warehouse, 'capacity');
  if (!panelOpen(s, 'worker_assignment')) return null;
  if (freeWorkers(s) > 0) return allocate('capacity', 'assignWorker', 'dig');
  if (s.workersAssigned.tend > 0) return allocate('capacity', 'unassignWorker', 'tend');
  return null;
}

/** Whole seconds until the stock covers the item's price at the current rates, or null when waiting never gets there. */
function secondsUntil(s: GameState, cost: ItemCost, rates: Partial<Record<CostKey, number>>): number | null {
  let worst = 0;
  for (const [k, need] of Object.entries(cost) as [CostKey, number][]) {
    const short = need - stock(s, k);
    if (short <= 0) continue;
    const rate = rates[k] ?? 0;
    if (!(rate > 0)) return null;
    worst = Math.max(worst, short / rate);
  }
  return Math.max(1, Math.ceil(worst));
}

/** Rule 6: the soonest item reachable by waiting, critical-path items first (only `among` them, when given). */
function nextAffordable(s: GameState, among?: (ref: ItemRef) => boolean): NoAction['nextAffordable'] {
  const rates = ratesPerSec(s);
  const pick = (refs: readonly ItemRef[]) => {
    let best: { key: string; name: string; inSec: number } | null = null;
    for (const ref of refs) {
      const def = defOf(ref);
      if ((among && !among(ref)) || !panelOpen(s, def.panel) || !def.open(s)) continue;
      const inSec = secondsUntil(s, def.cost(s), rates);
      if (inSec !== null && (best === null || inSec < best.inSec)) best = { key: itemKey(ref), name: def.name, inSec };
    }
    return best;
  };
  return pick(CRITICAL_PATH[s.phase as Phase] ?? []) ?? pick(listItems());
}

/**
 * The one most useful next action (Story 1.21, UX-DR12), shared by NEST,
 * WRKR and the offline summary. Pure. First match wins:
 *
 * 1. the goal has latched → CONTINUE;
 * 2. food critical (net rate below zero, stock under the upkeep window) → the allocation fix;
 * 3. capacity critical → a Warehouse, or a worker on DIG;
 * 4. an affordable item from the phase's critical-path table, in table order;
 * 5. any affordable item;
 * 6. none, with the item that becomes affordable soonest (`NEXT AFFORDABLE: <item> IN ~<time>`).
 *
 * Thresholds come from `data/balance/nextAction.ts`, the tables from
 * `data/content/criticalPath.ts`. Every suggestion is one the matching action
 * in `actions/` accepts.
 */
export function getNextAction(state: GameState): NextAction {
  if (goalPending(state)) {
    return { kind: 'act', rule: 'goal', key: 'continue', verb: 'CONTINUE', intent: { action: 'continuePhase' }, panel: 'phase_indicator' };
  }
  const fix = foodFix(state) ?? capacityFix(state);
  if (fix) return fix;
  const path = (CRITICAL_PATH[state.phase as Phase] ?? []).find((ref) => isItemAffordable(state, ref));
  if (path) return suggestItem(state, path, 'critical_path');
  const any = listItems().find((ref) => isItemAffordable(state, ref));
  if (any) return suggestItem(state, any, 'affordable');
  const next = nextAffordable(state);
  return { kind: 'none', key: next ? `none:${next.key}:${next.inSec}` : 'none', nextAffordable: next };
}

/** Whether BUILD sells the item in this state (Story 1.24). */
function soldOnBuild(s: GameState, ref: ItemRef): boolean {
  const panel = sellerIn(s, ref);
  return PANEL_PLACEMENT[panel].tab === 'build' && panelOpen(s, panel);
}

/**
 * The items BUILD shows as cards (Story 1.24): Click Power from Phase 2, the
 * buildings and the research chain, in the order the rule tries them.
 */
export function buildItems(state: GameState): ItemRef[] {
  return listItems().filter((ref) => {
    if (ref.kind === 'upgrade') return state.phase !== Phase.EGG_LAYING;
    return PANEL_PLACEMENT[defOf(ref).panel].tab === 'build';
  });
}

/**
 * BUILD's highlighted card (Story 1.24, UX-DR17): its action is the tab's
 * pinned primary action. Among the BUILD items open in this phase, first an
 * affordable one from the phase's critical-path table, then any affordable
 * one; with none, the BUILD item that becomes affordable soonest (the header's
 * `NEXT: <item> IN ~<time>`). Pure, like `getNextAction`, and every suggestion
 * is one the matching action accepts.
 */
export function getBuildAction(state: GameState): NextAction {
  const sold = (ref: ItemRef) => soldOnBuild(state, ref);
  const affordable = (ref: ItemRef) => sold(ref) && defOf(ref).open(state) && defOf(ref).affordable(state);
  const path = (CRITICAL_PATH[state.phase as Phase] ?? []).find(affordable);
  if (path) return suggestItem(state, path, 'critical_path');
  const any = listItems().find(affordable);
  if (any) return suggestItem(state, any, 'affordable');
  const next = nextAffordable(state, sold);
  return { kind: 'none', key: next ? `none:${next.key}:${next.inSec}` : 'none', nextAffordable: next };
}
