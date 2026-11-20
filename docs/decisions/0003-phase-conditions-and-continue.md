# 0003. Phase conditions, evaluate/commit, and a latched goal

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md) D3; UX EXPERIENCE.md (GOAL MET, CONTINUE)

## Context

`PhaseStateMachine.tick` fires and commits the first matching guard every tick. Guards are opaque lambdas, so a
UI goal meter would have to copy thresholds. Colony has two outgoing transitions, so "the next phase" is ambiguous.

## Decision

- Remove `COLONY_TO_EXPANSION` (GDD: Combat is mandatory).
- Each `Transition` declares `conditions: { id, label, current(s), target(s) }[]`; `guard` is derived as all-met.
  `src/phases/transitions.ts` stays the only source of thresholds.
- Split the FSM: pure `evaluate(state)` every tick; `commit(transition, state, bus)` only from CONTINUE.
- When the goal is first met it latches (`state.phaseGoal`), survives dips and saves, and is cleared by commit and prestige.

## Consequences

- Phase changes become player-initiated; `onEnter` side effects run at tap time.
- E2E specs that rely on auto-transition must click `[data-action="continue"]`.
- Adds a save field (one migration step).
