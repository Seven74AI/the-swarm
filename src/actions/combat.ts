import type { ActionDeps } from './context';
import { commit, current, refuse, type ActionResult } from './result';
import { getEquipmentUpgradeCost } from '../systems/SoldierSystem';
import { soldierBalance } from '../data/balance/soldiers';
import type { BattleResult } from '../systems/BattleSystem';
import { MUTATIONS, purchaseMutation } from '../systems/MutationSystem';
import { getEnemyDefs } from '../systems/EnemySystem';
import { freeWorkers } from '../systems/Workforce';
import {
  SCOUT_BARRACKS_LEVEL,
  SCOUT_FOOD_COST,
  WARRIOR_BARRACKS_LEVEL,
  WARRIOR_FOOD_COST,
  getMaxScouts,
  getMaxWarriors,
  recruitScout as recruitScoutFrom,
  recruitWarrior as recruitWarriorFrom,
} from '../systems/RecruitmentSystem';

/** Send one free worker to soldier training (a worker with a job stays on it). */
export function trainSoldier(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (s.resources.workers < 1 || freeWorkers(s) < 1) return refuse('no_free_workers');
  if (s.resources.food < soldierBalance.costFood) return refuse('cannot_afford');
  return commit(deps, s, deps.soldierSystem.recruitSoldier(s));
}

/** Raise weapons one level (needs a Chitin Armory). */
export function upgradeWeapon(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (s.equipment.weapon >= soldierBalance.maxEquipmentLevel) return refuse('max_level');
  if ((s.buildings.chitin_armory?.level ?? 0) < 1) return refuse('locked');
  if (s.combatResources.chitin < getEquipmentUpgradeCost(s.equipment.weapon)) return refuse('cannot_afford');
  return commit(deps, s, deps.soldierSystem.upgradeWeapon(s));
}

/** Raise armour one level (needs Silk Weaving). */
export function upgradeArmor(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (s.equipment.armor >= soldierBalance.maxEquipmentLevel) return refuse('max_level');
  if ((s.buildings.silk_weaving?.level ?? 0) < 1) return refuse('locked');
  if (s.combatResources.silk < getEquipmentUpgradeCost(s.equipment.armor)) return refuse('cannot_afford');
  return commit(deps, s, deps.soldierSystem.upgradeArmor(s));
}

/**
 * Fight a battle now, against `enemyType` when given (the enemy on the enemy
 * card, Story 1.25). The result says how it went.
 */
export function fight(deps: ActionDeps, enemyType?: string): ActionResult<BattleResult> {
  const s = current(deps);
  if (s.combatSoldiers <= 0) return refuse('no_soldiers');
  if (enemyType !== undefined && !getEnemyDefs().some((e) => e.type === enemyType)) return refuse('unknown_id');
  if (enemyType) deps.bus.emit('battle_engage', { enemyType });
  const { newState, result } = deps.battleSystem.resolveBattle(s, enemyType);
  const r = commit(deps, s, newState);
  return r.ok ? { ok: true, value: result } : r;
}

/** Buy a colony mutation (once). */
export function buyMutation(deps: ActionDeps, id: string): ActionResult {
  const s = current(deps);
  const def = MUTATIONS.find((m) => m.id === id);
  if (!def) return refuse('unknown_id');
  if (s.mutations.find((m) => m.id === id)?.purchased) return refuse('already_owned');
  if (def.prerequisite && !s.mutations.find((m) => m.id === def.prerequisite)?.purchased) return refuse('locked');
  const cr = s.combatResources;
  if (cr.chitin < def.cost.chitin || cr.silk < def.cost.silk || cr.venom < def.cost.venom) return refuse('cannot_afford');
  const r = commit(deps, s, purchaseMutation(s, id));
  if (r.ok) deps.bus.emit('mutation_purchased', { mutationId: id, name: def.name });
  return r;
}

/** Recruit a scout from the workers (needs barracks). */
export function recruitScout(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (s.buildings.barracks.level < SCOUT_BARRACKS_LEVEL) return refuse('locked');
  if (s.soldiers.scouts >= getMaxScouts(s)) return refuse('at_capacity');
  if (s.resources.workers < 1) return refuse('no_free_workers');
  if (s.resources.food < SCOUT_FOOD_COST) return refuse('cannot_afford');
  return commit(deps, s, recruitScoutFrom(s));
}

/** Recruit a warrior from the workers (needs barracks Lv.2). */
export function recruitWarrior(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (s.buildings.barracks.level < WARRIOR_BARRACKS_LEVEL) return refuse('locked');
  if (s.soldiers.warriors >= getMaxWarriors(s)) return refuse('at_capacity');
  if (s.resources.workers < 1) return refuse('no_free_workers');
  if (s.resources.food < WARRIOR_FOOD_COST) return refuse('cannot_afford');
  return commit(deps, s, recruitWarriorFrom(s));
}

