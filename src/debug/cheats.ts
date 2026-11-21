/**
 * Dev-build cheats on `window.__swarm.cheats` (Story 1.34, AR24): add
 * resources, set the phase, skip N hours, set the seed.
 *
 * DEV BUILDS ONLY. main imports this module only inside
 * `if (import.meta.env.DEV)`, so a production build contains none of it
 * (tests/unit/debug/productionBuild.test.ts greps the bundle for
 * CHEATS_MARKER and the cheat names).
 *
 * Each cheat runs between ticks, reads the state once and writes it once with
 * a spread (never in place). A phase change goes through
 * `PhaseStateMachine.commit`, the only code that moves the phase forward, and
 * its events reach the bus after the write, as a tick's do. E2E tests keep
 * seeding saves; they don't depend on cheats.
 */
import type { EventBus } from '../engine/EventBus';
import { EventQueue } from '../engine/events';
import type { PhaseStateMachine } from '../phases/PhaseStateMachine';
import { Phase, PHASE_ORDER } from '../phases/phases';
import type { GameState } from '../state/GameState';
import { isSeed } from '../state/seed';
import { log } from '../utils/log';

/** Greps for this in the production bundle must find nothing. */
export const CHEATS_MARKER = 'swarm-cheats:dev-only';

/** The longest time skip, in hours: catch-up runs every tick, so longer ones freeze the page. */
export const MAX_SKIP_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

export type CheatResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

type MainResource = keyof GameState['resources'];
type CombatResource = keyof GameState['combatResources'];
export type CheatResource = MainResource | CombatResource;

export interface CheatDeps {
  read(): GameState;
  write(state: GameState): void;
  bus: EventBus;
  fsm: PhaseStateMachine;
  /** The offline catch-up (engine/catchUp.ts), run for `ms` of game time. */
  catchUp(state: GameState, ms: number): GameState;
}

export interface Cheats {
  /** Add whole amounts (negative takes away, never below 0). Eggs and larvae enter their pipelines. */
  addResources(amounts: Partial<Record<CheatResource, number>>): CheatResult;
  /** Move forward to `phase`, committing every phase in between (their onEnter runs). */
  setPhase(phase: Phase): CheatResult;
  /** Simulate `hours` of game time, as offline catch-up does (full efficiency). */
  timeSkip(hours: number): CheatResult;
  /** Set the game's seed (an unsigned 32-bit integer). */
  setSeed(seed: number): CheatResult;
}

const refuse = (reason: string): CheatResult => ({ ok: false, reason });
const OK: CheatResult = { ok: true };

export function createCheats(deps: CheatDeps): Cheats {
  log.info('cheats', `${CHEATS_MARKER}: window.__swarm.cheats has addResources, setPhase, timeSkip, setSeed`);
  return {
    addResources(amounts) {
      const s = deps.read();
      const resources = { ...s.resources };
      const combat = { ...s.combatResources };
      let eggPipeline = s.eggPipeline;
      let larvaPipeline = s.larvaPipeline;
      for (const [key, raw] of Object.entries(amounts)) {
        if (typeof raw !== 'number' || !Number.isFinite(raw)) return refuse(`not a number: ${key}`);
        const add = Math.floor(raw);
        if (key in resources) {
          const k = key as MainResource;
          const next = Math.max(0, Math.floor(resources[k] + add));
          const delta = next - resources[k];
          resources[k] = next;
          // Eggs and larvae live in their pipelines too (CLAUDE.md), or they never hatch.
          if (k === 'eggs') eggPipeline = { ...eggPipeline, count: Math.max(0, eggPipeline.count + delta) };
          if (k === 'larvae') larvaPipeline = { ...larvaPipeline, count: Math.max(0, larvaPipeline.count + delta) };
        } else if (key in combat) {
          const k = key as CombatResource;
          combat[k] = Math.max(0, Math.floor(combat[k] + add));
        } else {
          return refuse(`unknown resource: ${key}`);
        }
      }
      deps.write({ ...s, resources, combatResources: combat, eggPipeline, larvaPipeline });
      return OK;
    },

    setPhase(phase) {
      const s = deps.read();
      const target = PHASE_ORDER.indexOf(phase);
      if (target < 0) return refuse(`unknown phase: ${String(phase)}`);
      if (target <= PHASE_ORDER.indexOf(s.phase as Phase)) return refuse('only forward: prestige is the way back');
      const events = new EventQueue();
      let next = s;
      while (next.phase !== phase) {
        const t = deps.fsm.transitionFrom(next.phase);
        if (!t) return refuse(`no way out of ${next.phase}`);
        next = deps.fsm.commit(t, next, events);
      }
      deps.write(next);
      events.flushTo(deps.bus);
      return OK;
    },

    timeSkip(hours) {
      if (!Number.isFinite(hours) || hours <= 0) return refuse('hours must be above 0');
      if (hours > MAX_SKIP_HOURS) return refuse(`at most ${MAX_SKIP_HOURS} hours`);
      deps.write(deps.catchUp(deps.read(), Math.floor(hours * HOUR_MS)));
      return OK;
    },

    setSeed(seed) {
      if (!isSeed(seed)) return refuse('a seed is an integer from 0 to 2^32 − 1');
      deps.write({ ...deps.read(), seed });
      return OK;
    },
  };
}
