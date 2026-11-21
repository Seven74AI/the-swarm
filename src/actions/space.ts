import type { ActionDeps } from './context';
import { commit, current, refuse, type ActionResult } from './result';
import { MAX_SHIP_LEVEL, buildShip as build, canAffordShipCost, getShipCost, upgradeShip as upgrade } from '../systems/SpaceshipSystem';
import { MAX_PROBES, launchProbe as launch } from '../systems/ExplorationSystem';

/** Build the colony ship. */
export function buildShip(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (s.spaceship.level > 0) return refuse('already_owned');
  if (!canAffordShipCost(s, getShipCost(0))) return refuse('cannot_afford');
  const r = commit(deps, s, build(s));
  if (r.ok) deps.bus.emit('spaceship_build', { level: current(deps).spaceship.level });
  return r;
}

/** Upgrade the colony ship one level. */
export function upgradeShip(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (s.spaceship.level <= 0) return refuse('locked');
  if (s.spaceship.level >= MAX_SHIP_LEVEL) return refuse('max_level');
  if (!canAffordShipCost(s, getShipCost(s.spaceship.level))) return refuse('cannot_afford');
  const r = commit(deps, s, upgrade(s));
  if (r.ok) deps.bus.emit('spaceship_upgrade', { level: current(deps).spaceship.level });
  return r;
}

/** Send a probe with one scout: a running exploration in game-time ms. */
export function launchProbe(deps: ActionDeps, destination: string): ActionResult {
  const s = current(deps);
  if (s.spaceship.level <= 0) return refuse('locked');
  if (s.spaceProbes.length >= MAX_PROBES) return refuse('slots_full');
  if (s.soldiers.scouts < 1) return refuse('no_soldiers');
  const r = commit(deps, s, launch(s, destination));
  if (r.ok) deps.bus.emit('probe_launch', { destination });
  return r;
}
