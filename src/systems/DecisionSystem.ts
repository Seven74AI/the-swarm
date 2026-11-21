import type { EventSink } from '../engine/events';
import type { GameState, OpenDecision } from '../state/GameState';
import { decisionBalance } from '../data/balance/decisions';
import {
  DECISIONS,
  getDecision,
  isDecisionId,
  type DecisionDef,
  type DecisionEffect,
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
 * the risk). Story 3.1 (ADR 0005) replaces it with the seeded PRNG in state.
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

  const pool = DECISIONS.filter((d) => (d.phases as readonly string[]).includes(state.phase));
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

/** Whether `choice` of `def` can be taken now (its `requires` is met). */
export function canChoose(state: GameState, def: DecisionDef, choice: DecisionChoice): boolean {
  if (choice === 'ignore') return def.ignorePolicy !== 'unavoidable';
  const c = def.choices.find((x) => x.id === choice);
  if (!c) return false;
  return !c.requires || state.resources[c.requires.resource] >= c.requires.amount;
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

function applyEffect(state: GameState, e: DecisionEffect): GameState {
  switch (e.kind) {
    case 'add': {
      const v = Math.max(0, Math.floor(state.resources[e.resource] + e.amount));
      return { ...state, resources: { ...state.resources, [e.resource]: v } };
    }
    case 'lose_percent': {
      const have = state.resources[e.resource];
      const v = Math.max(0, have - Math.floor((have * e.percent) / 100));
      return { ...state, resources: { ...state.resources, [e.resource]: Math.floor(v) } };
    }
    case 'reveal_tiles':
      return revealTiles(state, e.count);
    case 'lose_scouts':
      return { ...state, soldiers: { ...state.soldiers, scouts: Math.max(0, state.soldiers.scouts - e.count) } };
  }
}

/**
 * Apply a choice (or `'ignore'`: a timeout) and close the event. Pure: the
 * outcome depends only on the state, including the roll drawn at spawn.
 * A choice that can't be taken returns `state` unchanged (same reference).
 */
export function applyChoice(state: GameState, def: DecisionDef, choice: DecisionChoice): GameState {
  let effects: readonly DecisionEffect[];
  if (choice === 'ignore') {
    effects = def.ignorePolicy === 'costly' ? (def.ignore ?? []) : [];
  } else {
    const c = def.choices.find((x) => x.id === choice);
    if (!c || !canChoose(state, def, choice)) return state;
    const open = state.decision.open;
    const roll = open && open.id === def.id ? open.roll : 1;
    effects = c.risk && roll < c.risk.chance ? [...c.effects, ...c.risk.effects] : c.effects;
  }
  let next = effects.reduce(applyEffect, state);
  next = withDecision(next, { open: null, nextSpawnSessionMs: null });
  return next;
}
