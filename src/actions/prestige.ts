import type { ActionDeps } from './context';
import { commit, current, refuse, type ActionResult } from './result';
import { PRESTIGE_UPGRADES, type PrestigeUpgradeId } from '../data/prestigeTree';
import {
  canPurchasePrestigeUpgrade,
  isPrestigeAvailable,
  prestige as doPrestige,
  purchasePrestigeUpgrade,
} from '../systems/PrestigeSystem';

/** Reset the colony for Legacy Points. */
export function prestige(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (!isPrestigeAvailable(s)) return refuse('not_ready');
  const next = doPrestige(s);
  const r = commit(deps, s, next);
  if (r.ok) {
    deps.bus.emit('prestige_triggered', {
      fromCount: s.prestige.count,
      toCount: next.prestige.count,
      legacyPointsGained: next.prestige.legacyPoints - s.prestige.legacyPoints,
      totalLegacyPoints: next.prestige.legacyPoints,
    });
  }
  return r;
}

/** Buy a prestige tree upgrade (once). */
export function buyPrestigeUpgrade(deps: ActionDeps, id: PrestigeUpgradeId): ActionResult {
  const s = current(deps);
  const upgrade = PRESTIGE_UPGRADES.find((u) => u.id === id);
  if (!upgrade) return refuse('unknown_id');
  if (s.prestigeTree.purchased.includes(id)) return refuse('already_owned');
  if (s.prestige.legacyPoints < upgrade.cost) return refuse('cannot_afford');
  if (!canPurchasePrestigeUpgrade(s, id)) return refuse('locked');
  const r = commit(deps, s, purchasePrestigeUpgrade(s, id) ?? s);
  if (r.ok) deps.bus.emit('prestige_upgrade_purchased', { upgradeId: id, upgradeName: upgrade.name });
  return r;
}
