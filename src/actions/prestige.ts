import type { ActionDeps } from './context';
import { commit, current, refuse, type ActionResult } from './result';
import { PRESTIGE_UPGRADES, type PrestigeUpgradeId } from '../data/prestigeTree';
import {
  CHRONO_SYNCHRONIZATION_COST,
  TEMPORAL_RESONANCE_COST,
  buyChronoSynchronization as buyCS,
  buyTemporalResonance as buyTR,
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

/** Offline efficiency 50% → 75%, for Legacy Points. */
export function buyTemporalResonance(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (s.offlineEfficiency !== 0.5) return refuse('already_owned');
  if (s.phase !== 'transcendence' && s.phase !== 'egg_laying') return refuse('locked');
  if (s.prestige.legacyPoints < TEMPORAL_RESONANCE_COST) return refuse('cannot_afford');
  return commit(deps, s, buyTR(s) ?? s);
}

/** Offline efficiency 75% → 100%, for void crystals. */
export function buyChronoSynchronization(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (s.offlineEfficiency >= 1) return refuse('already_owned');
  if (s.offlineEfficiency !== 0.75) return refuse('locked');
  if (s.resources.voidCrystals < CHRONO_SYNCHRONIZATION_COST) return refuse('cannot_afford');
  return commit(deps, s, buyCS(s) ?? s);
}
