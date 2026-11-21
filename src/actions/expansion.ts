import type { ActionDeps } from './context';
import { commit, current, refuse, type ActionResult } from './result';
import { MAX_ACTIVE_EXPEDITIONS, launchExpedition } from '../systems/ExpeditionSystem';

const GRID = 8;

/** Send scouts and warriors on an expedition: a running lifecycle in game-time ms. */
export function startExpedition(deps: ActionDeps, scouts: number, warriors: number, destination: string): ActionResult {
  const s = current(deps);
  if (s.expeditions.length >= MAX_ACTIVE_EXPEDITIONS) return refuse('slots_full');
  if (scouts < 0 || warriors < 0 || scouts + warriors === 0) return refuse('no_soldiers');
  if (s.soldiers.scouts < scouts || s.soldiers.warriors < warriors) return refuse('no_soldiers');
  const r = commit(deps, s, launchExpedition(s, scouts, warriors, destination));
  if (r.ok) deps.bus.emit('expedition_launch', { scouts, warriors, destination });
  return r;
}

/** Claim a discovered map tile next to owned territory. */
export function claimTile(deps: ActionDeps, x: number, y: number): ActionResult {
  const s = current(deps);
  const tile = x >= 0 && x < GRID && y >= 0 && y < GRID ? s.mapTiles[y * GRID + x] : undefined;
  if (!tile || !tile.discovered) return refuse('locked');
  if (tile.claimed) return refuse('already_owned');
  // claimTile mutates what it is given: hand it a copy of the parts it writes.
  const draft = { ...s, mapTiles: [...s.mapTiles], territory: { ...s.territory } };
  if (!deps.territorySystem.claimTile(x, y, draft)) return refuse('not_adjacent');
  return commit(deps, s, draft);
}
