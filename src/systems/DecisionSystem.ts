import type { EventSink } from '../engine/events';
import { crowdedPercent } from './Crowding';
import type { GameState, OpenDecision } from '../state/GameState';
import { decisionBalance } from '../data/balance/decisions';
import { PERCENT } from '../data/constants';
import {
  DECISIONS,
  getDecision,
  isDecisionId,
  type DecisionDef,
  type DecisionEffect,
  type DecisionStock,
} from '../data/content/decisions';

/**
 * Decision events (Story 1.28, D8, N3): pure rules, no class, no hidden state.
 *
 * - Spawning runs on the session clock (foreground play since this launch):
 *   `startDecisionSession` clears the spawn time at launch, the first tick
 *   draws one 2–3 min ahead, and an event opens once it has passed, if the
 *   phase has events, none is open and nothing (overlay, offline summary)
 *   holds spawning back.
 * - The countdown runs on game time and only while the sheet is shown (not
 *   while it waits behind another sheet or an overlay). The `double` setting
 *   slows it, `off` stops it; unavoidable events have none.
 * - Choices and timeouts go through one pure `applyChoice(state, event, choice | 'ignore')`.
 * - Offline catch-up never calls `tickDecisions`: no spawns, no countdown.
 *
 * Randomness comes in as `rand` (spawn time, which event, the roll that fixes
 * the risk): main passes draws from the tick's seeded stream, `ctx.rng`
 * (Story 3.1, ADR 0005), so the same state and seed spawn the same events.
 */

export type DecisionTimerMode = 'normal' | 'double' | 'off';
export type DecisionChoice = string | 'ignore';

export interface DecisionTickInput {
  /** Session clock after this tick, ms of foreground play since launch. */
  readonly sessionMs: number;
  /** Game time this tick, ms. */
  readonly dtMs: number;
  /** The decision sheet is on screen (not waiting behind a sheet or overlay). */
  readonly shown: boolean;
  /** No overlay or offline summary is up. */
  readonly canSpawn: boolean;
  readonly timers: DecisionTimerMode;
  /** Uniform in [0, 1). */
  readonly rand: () => number;
  readonly events: EventSink;
}

const withDecision = (state: GameState, decision: GameState['decision']): GameState => ({ ...state, decision });

function spawnDelay(rand: () => number): number {
  const { spawnMinMs, spawnMaxMs } = decisionBalance;
  return spawnMinMs + Math.floor(rand() * (spawnMaxMs - spawnMinMs));
}

/** Whether this event counts down under the timer setting. */
export function isTimed(def: DecisionDef, timers: DecisionTimerMode): boolean {
  return def.ignorePolicy !== 'unavoidable' && def.timerMs !== undefined && timers !== 'off';
}

/** Real game-time ms left, given the setting (`remainingMs` is in the event's own time). */
export function displayRemainingMs(open: OpenDecision, timers: DecisionTimerMode): number | null {
  if (open.remainingMs === null || timers === 'off') return null;
  return timers === 'double' ? open.remainingMs * decisionBalance.doubleTimerFactor : open.remainingMs;
}

/**
 * A new session (launch, reload): the spawn time is drawn again on the first
 * foreground tick. An open event stays, with its time left; one whose id no
 * longer exists (content removed) is dropped.
 */
export function startDecisionSession(state: GameState): GameState {
  const open = state.decision?.open ?? null;
  const keep = open && isDecisionId(open.id) ? open : null;
  return withDecision(state, { open: keep, nextSpawnSessionMs: null });
}

/** One foreground tick of the decision events. */
export function tickDecisions(state: GameState, input: DecisionTickInput): GameState {
  const { open, nextSpawnSessionMs } = state.decision;

  if (open) {
    const def = getDecision(open.id);
    if (!input.shown || open.remainingMs === null || !isTimed(def, input.timers)) return state;
    const step = input.timers === 'double' ? Math.floor(input.dtMs / decisionBalance.doubleTimerFactor) : Math.floor(input.dtMs);
    const remainingMs = Math.max(0, open.remainingMs - step);
    if (remainingMs > 0) return withDecision(state, { ...state.decision, open: { ...open, remainingMs } });
    input.events.emit('decision_resolved', { id: def.id, choice: 'ignore', timedOut: true, policy: def.ignorePolicy });
    return applyChoice(state, def, 'ignore');
  }

  if (nextSpawnSessionMs === null) {
    return withDecision(state, { open: null, nextSpawnSessionMs: input.sessionMs + spawnDelay(input.rand) });
  }
  if (input.sessionMs < nextSpawnSessionMs || !input.canSpawn) return state;

  const pool = DECISIONS.filter((d) => (d.phases as readonly string[]).includes(state.phase) && isEligible(state, d));
  if (pool.length === 0) {
    return withDecision(state, { open: null, nextSpawnSessionMs: input.sessionMs + spawnDelay(input.rand) });
  }
  const def = pool[Math.min(pool.length - 1, Math.floor(input.rand() * pool.length))];
  const opened: OpenDecision = {
    id: def.id,
    remainingMs: def.ignorePolicy !== 'unavoidable' && def.timerMs !== undefined ? def.timerMs : null,
    openedAtSessionMs: input.sessionMs,
    roll: input.rand(),
  };
  input.events.emit('decision_spawned', { id: def.id });
  return withDecision(state, { open: opened, nextSpawnSessionMs });
}

/**
 * The nest is crowded enough for OVERCROWDING.: crowding (Story 9.13, the
 * same rule that slows the work) costs at least
 * `decisionBalance.overcrowdingMinWorkPercent` of it (Story 9.18).
 */
export function isCrowded(state: GameState): boolean {
  return (crowdedPercent(state) ?? 0) >= decisionBalance.overcrowdingMinWorkPercent;
}

/** Whether `def` may spawn in this state, beyond its phase (Story 4.5: OVERCROWDING. needs a crowded nest). */
export function isEligible(state: GameState, def: DecisionDef): boolean {
  return def.spawnsWhen !== 'crowded' || isCrowded(state);
}

/** How much of a decision stock the colony holds. */
export function stockOf(state: GameState, stock: DecisionStock): number {
  switch (stock) {
    case 'guards':
      return state.workersAssigned.guard;
    case 'soldiers':
      return state.combatSoldiers;
    case 'chitin':
      return state.combatResources.chitin;
    case 'scouts':
      return state.soldiers.scouts;
    default:
      return state.resources[stock];
  }
}

/** Whether `choice` of `def` can be taken now (its `requires` is met). */
export function canChoose(state: GameState, def: DecisionDef, choice: DecisionChoice): boolean {
  if (choice === 'ignore') return def.ignorePolicy !== 'unavoidable';
  const c = def.choices.find((x) => x.id === choice);
  if (!c) return false;
  return !c.requires || stockOf(state, c.requires.stock) >= c.requires.amount;
}

/** The job roles, in the order a worker loss empties them: the guard role last (it holds the Colony goal). */
const JOB_ORDER = ['gather', 'forage', 'tend', 'dig', 'guard'] as const;

/**
 * Remove up to `count` workers, never below `floor` (Story 4.5: no outcome
 * wipes the colony). Free workers go first, then workers off their roles in
 * `JOB_ORDER`; `fromRole` takes them off that role first (a guard loss).
 * Researchers are outside `resources.workers` and are never lost here.
 */
function removeWorkers(state: GameState, count: number, floor: number, fromRole?: (typeof JOB_ORDER)[number]): GameState {
  const have = state.resources.workers;
  const lost = Math.max(0, Math.min(Math.floor(count), have - floor));
  if (lost === 0) return state;
  const assigned = { ...state.workersAssigned };
  let left = lost;
  if (fromRole) {
    const off = Math.min(left, assigned[fromRole]);
    assigned[fromRole] -= off;
    left -= off;
  }
  const jobs = JOB_ORDER.reduce((a, j) => a + assigned[j], 0);
  // Free workers cover what is left first; the roles give up only the rest.
  let owed = Math.max(0, jobs - (have - lost));
  for (const j of JOB_ORDER) {
    const off = Math.min(owed, assigned[j]);
    assigned[j] -= off;
    owed -= off;
  }
  return { ...state, resources: { ...state.resources, workers: have - lost }, workersAssigned: assigned };
}

/** Set a stock to `value` (whole, ≥ 0); eggs and larvae move their pipeline with them. */
function setStock(state: GameState, stock: DecisionStock, value: number, floor: number): GameState {
  const v = Math.max(0, Math.floor(value));
  const delta = v - stockOf(state, stock);
  if (delta === 0) return state;
  switch (stock) {
    case 'workers':
      return delta < 0 ? removeWorkers(state, -delta, floor) : { ...state, resources: { ...state.resources, workers: v } };
    case 'guards':
      // Guards are workers on the guard role: a loss leaves the colony; a gain is a free worker put on guard.
      return delta < 0
        ? removeWorkers(state, -delta, floor, 'guard')
        : {
            ...state,
            resources: { ...state.resources, workers: state.resources.workers + delta },
            workersAssigned: { ...state.workersAssigned, guard: v },
          };
    case 'soldiers':
      return { ...state, combatSoldiers: v };
    case 'chitin':
      return { ...state, combatResources: { ...state.combatResources, chitin: v } };
    case 'scouts':
      return { ...state, soldiers: { ...state.soldiers, scouts: v } };
    case 'eggs':
      return {
        ...state,
        resources: { ...state.resources, eggs: v },
        eggPipeline: { ...state.eggPipeline, count: Math.max(0, state.eggPipeline.count + delta) },
      };
    case 'larvae':
      return {
        ...state,
        resources: { ...state.resources, larvae: v },
        larvaPipeline: { ...state.larvaPipeline, count: Math.max(0, state.larvaPipeline.count + delta) },
      };
    default:
      return { ...state, resources: { ...state.resources, [stock]: v } };
  }
}

function revealTiles(state: GameState, count: number): GameState {
  const tiles = state.mapTiles;
  if (tiles.length === 0 || count <= 0) return state;
  const cx = tiles.reduce((a, t) => a + t.x, 0) / tiles.length;
  const cy = tiles.reduce((a, t) => a + t.y, 0) / tiles.length;
  const near = tiles
    .filter((t) => !t.discovered)
    .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy) || a.x - b.x || a.y - b.y)
    .slice(0, count);
  if (near.length === 0) return state;
  const pick = new Set(near);
  return { ...state, mapTiles: tiles.map((t) => (pick.has(t) ? { ...t, discovered: true } : t)) };
}

function applyEffect(state: GameState, e: DecisionEffect, floor: number): GameState {
  switch (e.kind) {
    case 'add':
      return setStock(state, e.stock, stockOf(state, e.stock) + e.amount, floor);
    case 'lose_percent': {
      const have = stockOf(state, e.stock);
      return setStock(state, e.stock, have - Math.floor((have * e.percent) / PERCENT), floor);
    }
    case 'reveal_tiles':
      return revealTiles(state, e.count);
  }
}

/** The fewest workers an outcome may leave: a share of the workers on hand, and never the last one. */
function workerFloor(state: GameState): number {
  return Math.ceil(state.resources.workers * decisionBalance.workerFloorShare);
}

/**
 * Apply a choice (or `'ignore'`: a timeout) and close the event. Pure: the
 * outcome depends only on the state, including the roll drawn at spawn.
 * A choice that can't be taken (or ignoring an unavoidable event) returns
 * `state` unchanged (same reference).
 */
export function applyChoice(state: GameState, def: DecisionDef, choice: DecisionChoice): GameState {
  let effects: readonly DecisionEffect[];
  if (choice === 'ignore') {
    if (!canChoose(state, def, choice)) return state;
    effects = def.ignorePolicy === 'costly' ? (def.ignore ?? []) : [];
  } else {
    const c = def.choices.find((x) => x.id === choice);
    if (!c || !canChoose(state, def, choice)) return state;
    const open = state.decision.open;
    const roll = open && open.id === def.id ? open.roll : 1;
    effects = c.risk && roll < c.risk.chance ? [...c.effects, ...c.risk.effects] : c.effects;
  }
  const floor = workerFloor(state);
  let next = effects.reduce((acc, e) => applyEffect(acc, e, floor), state);
  next = withDecision(next, { open: null, nextSpawnSessionMs: null });
  return next;
}
