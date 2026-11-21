# 0006. Player intents are actions with typed refusals; lifecycles are status unions

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  AR16, AR22, AR23 · Story 1.6 (#236)

## Context

Panels called systems directly and wrote the result back through a `setState` callback. A refused tap (can't afford,
no free worker) returned the same state and the player saw nothing. Lifecycle state (research, battles, expeditions,
explorations) used loose `state`/`progress` fields, tick counters and wall-clock timestamps or IDs (`Date.now()`).

## Decision

- **Actions** (`src/actions/`): one function per player intent, bound to the boot-time systems by `createActions()`.
  Each validates against the current state and either writes the new state once (between ticks) and returns
  `{ ok: true }` (plus `value` when it reports something, like a battle result), or returns
  `{ ok: false, reason }` with a `RefusalReason` from `REFUSAL_REASONS` and leaves the state reference untouched.
  Events an action raises go out after its write. `ui/components/refusal.ts` turns a reason into words on the control.
- **`ui/` never imports `systems/`**, enforced by `tests/arch/architecture.test.ts`. Panels change state only through
  the `Actions` object they are given. Pure read-only rules they draw with (costs, caps, effects, content tables) are
  re-exported by `src/state/queries.ts`, next to the signal selectors in `src/state/selectors.ts`. Never re-export a
  function that returns a new state there.
- **Lifecycles** are discriminated unions on `status`, timed in game-time ms (`remainingMs`, `progressMs`,
  `durationMs`, `atMs` = `stats.playTimeMs`), made by pure factories (`createExpedition`, `createExploration`,
  `createProbe`) with sequential IDs from `state.nextIds`. Entries that resolve in the tick they end are removed then,
  so collections only hold `running`. Save v14 converts older saves.

## Consequences

- A refused tap always has a reason the UI can show; new intents add an action and, if needed, a reason.
- Panels can be unit-tested with real actions over a test store (`tests/unit/helpers/actions.ts`).
- Validation lives in actions next to the systems' own guards; the action tests cover both paths of every intent, and
  `commit` refuses with `unavailable` if a system unexpectedly returns the same state.
