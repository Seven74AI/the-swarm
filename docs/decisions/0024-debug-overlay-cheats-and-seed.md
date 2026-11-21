# 0024. A debug overlay in its own chunk, dev-only cheats, and the seed in the save

- **Status:** accepted (2026-11-21)
- **Source:** Story 1.34 (#264) · AR24 · arch D6, ADR 0005, 0013, 0018

## Context

A bug seen on a phone is hard to reproduce: nobody can see the tick cost, how long resume took, which seed the game
ran with or what the log said. Developers also need to reach late game states quickly without hand-editing saves.
The architecture allows the overlay in production behind `?debug=1` but cheats only in dev builds, tree-shaken
away, and only `main` may import `debug/`. There was no seed in the state yet (Story 3.1 adds the generator).

## Decision

- **`state.seed`** (`src/state/seed.ts`): an unsigned 32-bit integer in `GameState`, added by save migration
  v18 → v19, which derives a stable seed from the save's timestamp when a save has none. `createInitialState()` uses
  `DEFAULT_SEED`; main draws a fresh seed for a new game. Prestige keeps it (it spreads the state). Story 3.1 seeds
  its generator from this field. Diagnostics repeat it at the top (`seed`).
- **Timings** (`debug/timings.ts`, statically imported by main): main wraps the tick's `step` in
  `createTickTimings().measure` (a 240-tick ring, nearest-rank p50/p95) and times resume-on-load (`catchUpMs`).
  Nothing is logged per tick.
- **The overlay** (`debug/overlay.tsx` `mountDebugOverlay`, `debug/DebugOverlay.tsx`, `debug/toggle.ts`) is loaded
  with a dynamic `import()` only when `debugEnabled({dev, search})` (`debug/enabled.ts`) holds: dev builds, or
  `?debug=1`. It adds one empty `[data-debug-root]` (`[data-ready]` once bound) and draws
  `[data-debug-overlay]` while open. It reads the state with `peek()` every 500 ms (never per tick) and writes
  nothing; its EXPORT DIAGNOSTICS is main's settings export. It sits above sheets and overlays (z-index 3000) and is
  not part of the overlay layer (ADR 0014): it never holds sheets.
- **Cheats** (`debug/cheats.ts` `createCheats`) are created only inside `import.meta.env.DEV ? import(...) : null`
  in main, exposed as `window.__swarm.cheats` once loaded. Each reads once and writes once with a spread.
  `setPhase` moves forward only, through `PhaseStateMachine.commit` for every phase in between (new
  `transitionFrom(phase)`), and flushes `phase_committed` after the write. `timeSkip(hours)` (≤ 24 h) runs the
  offline catch-up, now `engine/catchUp.ts` (shared with resume-on-load), at full efficiency.
  `tests/unit/debug/productionBuild.test.ts` builds the real config and asserts the bundle has none of the cheat
  code (`CHEATS_MARKER` and the cheat names) but does have the overlay.

## Consequences

- Production ships the overlay chunk (only fetched with `?debug=1`) but never the cheats.
- `SaveManager.SAVE_VERSION` is public (read-only) so the overlay and tests can name it.
- E2E tests keep seeding saves; cheats are a developer tool, not a test fixture.
