# 0002. Visible-only simulation and a single resume path

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md) D1, D2

## Context

Mobile browsers suspend hidden tabs. The prototype saves only on `beforeunload` (often skipped on mobile), drops
hidden time through a 1 s frame cap, has three different caps (4 h, 8 h, 1 s), and replays offline pipelines tick by
tick (~432k–864k ticks for 12 h), which misses the GDD's 500 ms catch-up budget.

## Decision

- The fixed 20 Hz step runs only while the game is visible. On `visibilitychange` → hidden or `pagehide`: save
  with a `lastSeenAt` timestamp and stop.
- Every return goes through `resume(elapsedMs)`: cold start, return from background, and visible frame gaps over 1 s.
  Gaps under 60 s run at full efficiency; longer gaps are offline time at the offline efficiency, capped by one
  `getOfflineCapMs(state)`.
- Offline catch-up runs the same `processTick` with macro-steps. No decision events, no phase commits offline.
- Pause is in-session only; hiding or closing the app ends it.

## Consequences

- One code path for the game, offline catch-up and the pacing harness.
- Systems must be correct for any step length (rates × dt, flooring at credit/spend).
- CI gates the catch-up on a deterministic step budget; wall-clock time is measured on the reference phone.
- No web notifications: a closed page cannot detect events (see 0004).
