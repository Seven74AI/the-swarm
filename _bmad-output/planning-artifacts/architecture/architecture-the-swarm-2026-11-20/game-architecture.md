---
title: 'Game Architecture'
project: 'the-swarm'
date: '2026-11-20'
author: 'Seven74'
version: '1.0'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
status: 'complete'
engine: 'none (web stack: TypeScript + Vite 8 + Preact 11 + @preact/signals)'
platform: 'mobile web PWA (portrait) first; desktop browser; optional Capacitor store build later'
baseline_code: 'Seven74AI/the-swarm main @ a332d82'

# Source Documents
gdd: '_bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/gdd.md'
epics: '_bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/epics.md'
brief: '_bmad-output/planning-artifacts/briefs/brief-the-swarm-2026-11-20/brief.md'
ux:
  - '_bmad-output/planning-artifacts/ux-designs/ux-the-swarm-2026-11-20/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-the-swarm-2026-11-20/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-the-swarm-2026-11-20/review-code-feasibility.md'
---

# Game Architecture

## Document Status

**Status:** complete (v1.0, 2026-11-21). Created with the GDS Architecture Workflow, all 9 steps.
Source code stays authoritative for current behaviour; this document is the target architecture
for the mobile-first rework. Change it through a PR (`gds-correct-course`), not in place.

## Executive Summary

**THE SWARM** architecture is a web stack with no game engine: TypeScript, Vite 8, Preact 11 and
`@preact/signals`, targeting an installable mobile-web PWA (portrait) first, desktop browsers second,
and an optional Capacitor store build later.

**Key Architectural Decisions:**

- **One time model:** the simulation runs at a fixed 20 Hz only while the game is visible. Every return
  (cold start, background, long frame) goes through one `resume(elapsedMs)` with one offline cap and
  macro-step catch-up; gaps under 60 s count at full efficiency (D1, D2).
- **Phase flow under player control:** guard conditions are declared in `transitions.ts`; a pure
  `evaluate()` latches GOAL MET and `commit()` runs only on CONTINUE (D3).
- **State discipline:** one `GameState` signal, one spread write per tick, UI reads only `computed`
  selectors and writes only through actions; seeded PRNG in state (D5, D6).
- **Durable local saves:** `SaveStore` interface over localStorage, explicit load status, numbered
  migrations, settings outside the save (D4).
- **UI shell:** 5-tab registry, one sheet controller, one overlay layer; DOM-first for accessibility,
  SVG scenes with HTML labels (D7, D11).
- **Platform seams:** audio, haptics, notifications, storage and lifecycle behind interfaces; no
  notifications on web (D9, D10).
- **Pacing harness:** the real systems run headless; guard reachability gates CI, durations are a
  report (D12).

**Project Structure:** hybrid organization (layers at the top, features inside `ui/`) with 15 core
systems, enforced by import-boundary tests.

**Implementation Patterns:** 9 standard patterns and 3 novel patterns (countable-ant nest, pacing
harness, persistent paused decision events), each with examples.

**Ready for:** epics and stories (`gds-create-epics-and-stories`), then GitHub issues.

---

## Project Context

### Game Overview

**THE SWARM**: a mobile-first idle/incremental game. An ant queen's single egg grows through six
phases (nest → colony → battlefield → territory → space → transcendence), and each phase changes
what the player manages. Integer resources, physical pipelines, a real ending, prestige replays.

### Technical Scope

**Platform:** mobile web, portrait, touch (primary: 360×640 minimum, safe-area aware); desktop
browser ≥ 1024 px (secondary: the same screens in 2–3 columns). Distribution
(PWA, native wrapper or app stores) is decided in this document.
**Genre:** idle/incremental, single-player, auto-resolved combat.
**Project level:** brownfield rework. A working six-phase prototype (~14k lines of TS, 78 unit
test files, 24 E2E specs, save v13) is reshaped for a mobile-first MVP (Phases 1–3, E1–E5).
**Networking:** none. Local saves only; no accounts, cloud saves, leaderboards or multiplayer.

### Core Systems

| System | Complexity | Source |
|---|---|---|
| Simulation clock (20 Hz fixed step, visible-only, resume path) | High | GDD Technical Specifications; feasibility H-1 |
| Offline catch-up (single 12 → 24 h cap, 50/75/100% efficiency, starvation floor, < 500 ms) | High | GDD Economy; E2 |
| State store (single signal, one spread write per tick, slice selectors) | Medium | CLAUDE.md; #186 |
| Phase FSM: pure evaluate, commit on CONTINUE, latched goal, per-condition guards in `transitions.ts` | Medium | EXPERIENCE IA; feasibility C-1, H-2 |
| Persistence: versioned saves, migrations, rotating backup, load status, export/import | Medium | GDD Platform; feasibility M-5 |
| Economy and pipelines (integer resources, worker roles incl. new Forage, nest capacity) | Medium | GDD Mechanics; E3 |
| Combat (auto-resolve, enemy traits, causal battle summary, draw outcome) | Medium | GDD Combat interest bar; E4 |
| Decision events (game-time timers, 3 ignore policies, persisted open event, session spawn) | Medium | EXPERIENCE Decision events; H-4 |
| Next-action selector (pure `getNextAction`, shared by NEST, WRKR and the offline summary) | Medium | EXPERIENCE Next-action rule |
| UI shell: 5-tab IA, sheet controller, phase reveal, desktop columns, accessibility floor | High | EXPERIENCE; E1 (23 panels → 5 tabs) |
| Vector scenes: nest (camera scale, dot cloud), 8×8 map, star map | High (novel) | DESIGN Vector |
| Prestige and meta (full wipe except LP, Legacy, stats, victory; lifetime-LP bonus) | Medium | GDD Prestige; E5 (#192) |
| Platform services: settings store, audio, haptics, notifications | Medium | EXPERIENCE Settings; M-7 |
| Pacing harness: local telemetry, simulated player, guard-reachability check | Medium (novel) | E3; GDD Success Metrics |
| Post-MVP: expeditions and territory, space, entropy, Transcendence ending | Existing; re-skinned later | E6, E7 |

### Technical Requirements

- Fast first load, with no hard numeric target: the owner dropped the GDD's 2 MB download limit and
  its 3 s first-interactive target on 2026-11-21. Principle kept: terminal text renders first, the
  vector scene fades in when ready (EXPERIENCE.md Cold load), and the PWA precache makes later
  launches instant.
- Tap → visual response in < 100 ms; scrolling and transitions at 60 FPS.
- Game outcomes independent of frame rate and device speed.
- Offline catch-up for 12 h (24 h with upgrades) in < 500 ms on resume.
- The simulation runs only while the game is visible. Hidden time is treated like time offline:
  on return it is caught up once (capped) and summarized. Nothing runs in the background, so
  any notification has to be predicted ahead of time, not detected.
- All resources are integers; non-integer intermediates are internal only.
- Saves from every shipped version migrate or are retired explicitly.
- Accessibility floor: 44 px targets, reduced motion, live regions, keyboard, 320 px / 200% reflow.

### Complexity Drivers

- **Time model.** Foreground ticks, hidden time, cold load and resume must all go through
  one catch-up path with one cap, within the 500 ms budget on a phone.
- **UI consolidation.** 23 lazily revealed panels become 5 tabs, segments and one sheet
  controller, without breaking the ~24 E2E specs that seed and drive them.
- **Phase flow inversion.** Auto-firing guards become evaluate/commit with a latched goal;
  ~7 E2E specs and 4 unit files assume auto-transition.
- **Rendering split.** HTML "terminal" readouts plus an animated vector colony that must
  scale from 1 ant to thousands within the frame budget.

### Novel Concepts

- Countable-ant vector nest (individual ants → dot cloud, with exact counts in HTML overlays).
- Automated pacing harness: a simulated player checking in 6 times a day and a guard-reachability
  proof, both as CI-runnable tests (soft-lock rule).
- Decision events that survive app close with a paused game-time timer.

### Technical Risks

1. **Offline catch-up cost.** Resources are closed-form, but pipelines still run `processTick` once
   per tick (`main.ts`): ~432k ticks for 12 h at 50% efficiency, ~864k at 100%, against a 500 ms budget.
2. **Mobile browser lifecycle.** `visibilitychange`/`pagehide`, bfcache and iOS tab eviction can drop
   the last save or skip the resume path.
3. **Save-schema churn.** E2 (offline Legacy nodes), E5 (prestige wipe), the goal latch, seen reveals
   and the persisted log all want migrations; v14 steps can collide (CLAUDE.md rule).
4. **Platform limits.** No Vibration API on iOS Safari; web notifications need a service worker
   and, on iOS, an installed PWA.
5. **Test-suite inertia.** Phase-flow and panel changes invalidate many E2E seeds at once.
6. **Vector scene performance** on low-end phones at large colony sizes.
7. **Leftover state primitives** that agents may copy: `StateManager` and `Store` (unused outside
   their own tests) and `GameStatePool.spread()` (called 6× per tick, never recycles; recycling
   would break the reference equality that `computed` slice selectors rely on).

### Code vs. documentation discrepancies (found in this step)

- `package.json` pins **Vite ^8.3.8 and Vitest ^5.1.1**; the handoff says Vite 5.4.
- Three time caps exist, not two: 4 h (`OfflineProgression.ts:97`), 8 h (`GameLoop.ts:42`
  accumulator) and a 1 s frame cap (`Ticker.ts:83`) that silently drops hidden time.

## Engine & Framework

### Selected Stack

No game engine. A web stack:

| Layer | Choice | Version policy |
|---|---|---|
| Language | TypeScript (strict) | as pinned in `package.json` |
| Build / dev server | Vite 8 | current 8.x |
| Game state | `@preact/signals-core` (single `gameState` signal) | current 1.x |
| UI components | Preact 11 + `@preact/signals` | current 11.x / 2.x; must resolve to the same `signals-core` instance as the game state |
| Scenes | Inline SVG (nest, map, star map); Canvas 2D only for the nest dot cloud if SVG profiling fails | n/a |
| Unit / component tests | Vitest 5 + jsdom + Preact Testing Library | current |
| E2E | Playwright (Chromium in CI) | current |
| Package manager | pnpm 11 | pinned via `packageManager` |

Exact versions come from `package.json` at install time. This document names major lines only.

**Rationale:**
- The game is mostly HTML text (strip, meters, cards, sheets) plus an ambient vector scene. A
  DOM-first stack gives accessibility (live regions, focus, reflow) for free; a canvas engine
  would have to rebuild it.
- Keeps the prototype's simulation, ~1,330 unit tests, 24 E2E specs and the v1→v13 save chain.
- Preact is maintained alongside the signals library already in use. Components subscribe to
  signal slices directly, which removes hand-written dirty-checking (#186) and boilerplate in
  the 5-tab shell.
- Agent-friendly: TypeScript + Vitest + Playwright fit the issue → PR → CI-gated TDD loop.

**Rejected:**
- *Godot / Unity web export:* WebAssembly payloads of tens of MB, web exports that run much worse
  than native on phones, weak accessibility for a text-heavy UI, and a full rewrite of the code,
  tests and save chain.
- *Phaser 4 / PixiJS 8 as the main renderer:* built for canvas-first games. PixiJS is kept as a
  fallback for the nest scene only, if SVG can't hold the frame budget at large colony sizes.
- *Stay on vanilla DOM (no UI library):* viable, but every agent hand-rolls components, and
  drift between panels is already visible in the prototype.

**Note on load budgets (owner, 2026-11-21):** the GDD's 2 MB download limit and 3 s
first-interactive target are dropped as hard constraints. Load speed stays a quality goal.

### Distribution

**Web first:** an installable PWA on GitHub Pages (the current host). **Store later, optional:**
wrap the same build with Capacitor (8.x at the time of writing) for iOS and Android. Nothing in the
architecture may depend on the native wrapper, and nothing may rule it out: platform services sit
behind interfaces so that web and native implementations can be swapped (see Architectural Decisions).

### Project Initialization

Brownfield; no starter template. Adoption steps (each is a story):

1. Add `preact` and `@preact/signals`; configure JSX in `tsconfig.json`
   (`"jsx": "react-jsx"`, `"jsxImportSource": "preact"`). Use Vite's built-in JSX transform;
   add `@preact/preset-vite` only if its peer range covers Vite 8 (verify at install).
2. Add a check that exactly one `@preact/signals-core` version is installed (`pnpm why`).
3. Mount one Preact root per tab container; migrate panels one at a time, each keeping its
   `data-*` / `id` selectors so existing E2E specs keep passing.

### Stack-Provided Architecture

| Component | Solution | Notes |
|---|---|---|
| Rendering (UI) | Preact virtual DOM | Real DOM text; accessible by default |
| Rendering (scenes) | Inline SVG via Preact components | HTML overlays for labels (DESIGN.md) |
| Reactivity | Signals (`computed` slices) | Components subscribe to slices, never to the whole state |
| Physics | None needed | Combat is auto-resolved arithmetic |
| Audio | Web Audio API (existing `AudioSystem`) | Behind a platform-service interface |
| Input | DOM pointer and keyboard events | Hold-to-repeat and confirm are app-level primitives |
| Scene management | 5-tab shell + segments + sheet controller | App-level, not provided by Preact |
| Build | Vite 8 (Rolldown) | Static output to GitHub Pages |

### AI Tooling

- **Context7** (upstash/context7, MCP docs lookup): **accepted** (owner, 2026-11-21). Agents check
  current Vite 8, Preact 11 and Vitest 5 docs instead of relying on training data.
  - Local server: `claude mcp add context7 -- npx -y @upstash/context7-mcp`
  - Remote server: `claude mcp add --transport http context7 https://mcp.context7.com/mcp`
  - Optional free API key for higher rate limits. Needs Node.js 18+ for the local server.
  - Add to `CLAUDE.md`: "Use Context7 for library/API documentation before relying on memory."
  - Scheduled agent sessions need `mcp.context7.com` (remote) or the npm registry (local) on their
    network allowlist.
- No engine-specific MCP applies (no engine).

### Remaining Architectural Decisions

1. Simulation clock and time model (tick rate, visible-only run, resume, single offline cap).
2. Offline catch-up algorithm within the 500 ms budget.
3. State shape changes and the slice-selector pattern; the fate of `GameStatePool`,
   `StateManager` and `Store`.
4. Phase FSM split (evaluate / commit), the CONTINUE latch, per-condition guards.
5. Save schema: the v14+ plan, what lives outside the save (settings, intro flag), load status,
   export/import, the prestige-wipe migration.
6. UI shell: tab/segment registry, sheet controller and priority, phase reveal.
7. Decision-event engine (game-time timers, ignore policies, persistence).
8. Platform services (audio, haptics, notifications, storage) behind interfaces for PWA vs Capacitor.
9. PWA details: service worker, update strategy, offline asset caching.
10. Scene rendering budget and the SVG → Canvas/PixiJS fallback trigger.
11. Pacing harness: simulated player, reachability check, local telemetry.
12. Dependency hygiene (Dependabot alerts are development-scope; none ship to players).

## Architectural Decisions

### Decision Summary

| # | Category | Decision | Version | Rationale |
|---|---|---|---|---|
| D1 | Time model | 20 Hz fixed tick while visible; save and stop on hide; one `resume(elapsedMs)` for cold start and return; gaps < 60 s at full efficiency | n/a | Browsers suspend hidden tabs; one path is testable; no penalty for glancing away (owner) |
| D2 | Offline catch-up | Macro-steps through the same `processTick` | n/a | Fits 12–24 h in < 500 ms with one simulation code path |
| D3 | Phase flow | Conditions declared in `transitions.ts`; pure `evaluate()` + `commit()` on CONTINUE; latched goal | n/a | UX GOAL MET / CONTINUE; UI never restates thresholds |
| D4 | Persistence | localStorage behind `SaveStore`; load status; persistent-storage request; settings outside the save | n/a | Works, swappable for Capacitor, never fails silently |
| D5 | State | Single signal, one spread write per tick, `computed` selectors; delete `StateManager`, `Store`, `GameStatePool` | signals-core 1.x | Fixes #186 at the root; removes primitives agents copy |
| D6 | Randomness | Seeded PRNG, state stored in game state | n/a | Reproducible simulations and bug replays (owner) |
| D7 | UI shell | Tab registry + single `SheetController` + overlay layer | Preact 11.x | 23 panels → 5 tabs; sheets never stack |
| D8 | Decision events | Session foreground clock; data-declared ignore policy; open event persisted | n/a | Fixes spawn-on-load; closing the app is no escape |
| D9 | Platform services | `src/platform/` interfaces, web implementations, Capacitor later; no notifications on web | Capacitor 8.x (later) | Store build stays possible; the web cannot detect events while closed (owner) |
| D10 | Distribution / PWA | vite-plugin-pwa, precache everything, update on next cold start, `display: standalone` | vite-plugin-pwa ≥ 1.3 | Offline play, home-screen storage exemption, no mid-session reloads |
| D11 | Scene rendering | SVG, ≤ 50 animated ants, dot cloud as one path, own rAF loop with ≤ 4 Hz slice reads | n/a | Frame budget on low-end phones, with a measured fallback |
| D12 | Pacing harness | Headless `src/sim/`; reachability gates CI; duration targets are a report only | n/a | Soft-lock rule enforced; no balance numbers in tests |
| D13 | Dependency hygiene | Policy set in Cross-cutting Concerns | n/a | Development-scope; none ship to players |

Versions verified on 2026-11-21: Vite 8.3.x, Preact 11.x (11.0 released October 2026),
`@preact/signals` 2.x, `@preact/signals-core` 1.x, vite-plugin-pwa ≥ 1.3.0 (first release with Vite 8
support), Capacitor 8.x. Exact pins come from `package.json`.

Owner decisions in this step (2026-11-21): Q1 gaps under 60 s run at full efficiency; Q2 no
notifications in the web build (store build later); Q3 seeded PRNG; D1–D3 accepted explicitly;
D4–D13 accepted as recommended.

### Time Model (D1)

- **Visible:** `Ticker` runs a 50 ms fixed step (20 Hz) on rAF. Outcomes depend on ticks, never on frames.
- **Hidden** (`visibilitychange` → hidden, or `pagehide`): force a save with a `lastSeenAt` wall-clock
  timestamp, then stop the ticker. `beforeunload` stays as a fallback only.
- **Return or cold start:** `resume(elapsedMs)` is the only entry point.
  - `elapsedMs ≤ 0` (clock skew) → 0.
  - `elapsedMs < 60 s` → simulated at full efficiency; no summary sheet; strip deltas flash.
  - `elapsedMs ≥ 60 s` → offline catch-up (D2) at the current offline efficiency, then the offline summary.
- **One cap:** `getOfflineCapMs(state)` (12 h base, raised to 24 h by Legacy upgrades). It replaces the
  4 h cap (`OfflineProgression.ts`), the 8 h cap (`GameLoop.ts`) and the frame cap that drops hidden time.
- **Clocks:** wall clock (`Date.now`) only for gaps; game time (tick count) for everything simulated.
  A session clock (foreground ticks since this launch) drives decision-event spawning (D8).
- **Long frames while visible:** a frame gap over 1 s (device stall, throttled tab that never fired
  `visibilitychange`) is handed to `resume(gap)` instead of being dropped by the frame cap.
- **Pause is in-session only** (owner, validation step): PAUSE stops the ticker; hiding or closing
  the app ends the pause, and the time away counts as normal offline time. No `paused` flag in the save.

### Offline Catch-up (D2)

- Runs the same `processTick` systems with a macro-step `dt` (initial value 10 s; tuned by the perf test).
- Systems must be correct for any step length: rates × `dt`, integer flooring where amounts are spent
  or displayed, every pipeline exit feeding the next pipeline (existing rule).
- Offline-only rules apply inside catch-up: the efficiency multiplier, the starvation floor (workers never
  below 50% of the pre-absence count), no decision events, no phase commits (the latch may set).
- **Tests:** a property test compares macro-step with fine-step results within a tolerance on random
  seeded states and checks the invariants (integers, never above capped production, starvation floor).
  The CI gate is deterministic: a 24 h catch-up uses at most a fixed number of `processTick` calls
  (from `data/constants.ts`). Wall-clock time against the 500 ms budget is measured on the reference
  phone and reported (`pnpm perf`); timing is not asserted on CI runners, so CI never flakes on speed.

### Phase Flow (D3)

- `Transition` gains `conditions: { id, label, current(s), target(s) }[]`; `guard` is derived as
  all-met. `transitions.ts` stays the only source of thresholds.
- `PhaseStateMachine` splits into `evaluate(state) → Transition | null` (pure, every tick) and
  `commit(transition, state, bus)` (runs `onEnter`, emits `phase_committed`, which replaces the existing
  `phase_changed`; see Event System), called only from CONTINUE.
- **Latch:** when `evaluate` first returns a transition, `state.phaseGoal = { phase, latched: true }`
  is written. It survives dips and saves and is cleared by `commit` and by prestige.
- Order: remove `COLONY_TO_EXPANSION` → add conditions → split the FSM → migrate the E2E seeds to
  tap CONTINUE (`data-action="continue"`).

### Data Persistence (D4)

- **Store:** a `SaveStore` interface; the web implementation uses localStorage (the current key and
  2-slot rotating backup). A Capacitor implementation can replace it without touching game code.
- **Load:** `load() → { status: 'ok' | 'recoveredFromBackup' | 'unreadable' | 'empty', state? }`,
  which drives the corrupt-save sheet. Never a silent reset.
- **Durability:** call `navigator.storage.persist()` after the first meaningful play; show a one-time
  "add to home screen" hint (home-screen web apps are exempt from Safari's 7-day storage cap);
  export/import is the player's backup.
- **Inside the save:** game state, the `phaseGoal` latch, the open decision event with its remaining
  time, the event log (last 100 lines), `lifetime.revealsSeen`, `lifetime.phasesCompleted` (for the
  Phase Skip rule: never skip a phase that was never completed), the PRNG state.
- **Outside the save** (own keys; survive prestige and import; not exported): settings, intro flag.
- **Migrations:** one numbered step per schema change, in order; two branches claiming the same
  version merge into one function (existing rule). The E5 prestige wipe is a normal step.

### State Management (D5)

- One `signal<GameState>`; one spread-based write per tick; user actions write between ticks.
- `src/state/selectors.ts` exports `computed` slices. Components and effects read only selectors,
  never `gameState.value` directly.
- Delete `StateManager`, `Store` (dead outside their own tests) and `GameStatePool` (allocates
  normally; recycling would break selector reference equality).

### Randomness (D6)

- A small seeded PRNG (for example a 32-bit generator) with its state in `GameState`. Systems take it
  as input and return the advanced state; no `Math.random` in `src/systems` or `src/sim`.
- UI-only randomness (particles, wandering ants) may use `Math.random`.
- Tests keep asserting invariants (`Victory | Defeat`), but a seed can reproduce a reported bug.

### UI Shell (D7)

- **Tab registry** (data, not code): `{ panelId → tab, segment?, unlockPhase }`. It replaces
  `PHASE_PANELS` in `PhaseContent.ts`. A test asserts that no phase shows a sixth tab.
- **SheetController:** one signal holding the open sheet and a queue. Priority: offline summary >
  decision event > battle summary > other modal > peek. Modal sheets never stack; opening a modal
  closes any peek.
- **Overlay layer:** phase reveal, title cinematic and Transcendence ending. Overlays block input,
  and decision events wait until they end.
- **Desktop:** the same components, laid out in columns by CSS from 1024 px.

### Decision Events (D8)

- Events are data: `{ id, phases, ignorePolicy: 'free' | 'costly' | 'unavoidable', timerMs?,
  ignoreLine, choices[], ignore? }`.
- Spawning uses the session clock (≥ 2 min of foreground play since launch); never during an overlay
  or before the offline summary is dismissed; at most one open.
- The countdown runs on game time, so it pauses when hidden or paused. An open event is saved with
  its remaining time and reopens on resume.
- Choices and timeouts go through one pure `applyChoice(state, event, choice | 'ignore')`.

### Platform Services (D9)

- `src/platform/` interfaces: `Audio`, `Haptics`, `Notifications`, `Storage`, `Lifecycle`.
  Web implementations; Capacitor implementations only when a store build is started.
- Haptics: `navigator.vibrate` where available, otherwise a no-op; never the only feedback.
- Notifications: **none in the web build** (owner). The interface exists so that a store build can
  schedule local notifications at predicted times. The settings toggle is hidden on web.

### Distribution and PWA (D10)

- Static build to GitHub Pages; vite-plugin-pwa generates the manifest and the service worker.
- Precache all assets (glyphs are inline SVG, audio is synthesized, no lazy loading).
- A new version activates on the next cold start; never reload during a session.
- Manifest `display: "standalone"`, portrait orientation.

### Scene Rendering (D11)

- Nest, map and star map are Preact SVG components; labels are HTML overlays (DESIGN.md).
- At most 50 individually animated ants; the rest is a dot cloud drawn as one SVG path.
- Scene animation runs in its own rAF loop, reads slices at most 4 times per second, and stops under
  reduced motion.
- **Fallback trigger** (measured on the reference phone via `pnpm perf`, not asserted in CI): if p95
  frame time exceeds 16 ms,
  move the dot cloud to Canvas 2D; consider PixiJS only if Canvas is not enough.

### Pacing Harness (D12)

- `src/sim/`: headless and DOM-free; drives the real systems with a scripted check-in schedule and a
  simple player policy (allocate, buy the next-action item, CONTINUE).
- **CI-gating:** guard reachability for every phase from that phase's own production (soft-lock rule).
- **Report only** (`pnpm sim`, not in CI): phase durations against the GDD targets. Hard-coding them
  in tests would violate "test invariants, never balance numbers".
- **Telemetry:** a local ring buffer (time per phase, check-in length, decisions per check-in),
  exportable from settings; no network.

### Architecture Decision Records

Recorded as ADRs in `docs/decisions/` (created in the same PR as this document):

1. `0001-single-state-signal-with-selectors.md`: one game-state signal with `computed` selectors; delete the legacy state primitives (D5, #186).
2. `0002-visible-only-simulation-and-resume.md`: visible-only simulation and the single resume path (D1, D2).
3. `0003-phase-conditions-and-continue.md`: phase conditions, evaluate/commit and the latched goal (D3).
4. `0004-preact-ui-and-pwa-distribution.md`: Preact for the UI layer, web-first PWA, optional Capacitor (Engine & Framework, D9, D10).
5. `0005-seeded-prng-in-state.md`: seeded PRNG in game state (D6).

### Follow-ups for other planning artifacts

- GDD/UX: notifications are removed from the web build (Q2). Update the E2 notification story and
  EXPERIENCE.md Settings through `gds-correct-course` when the stories are written.
  **Done 2026-11-21** (`sprint-change-proposal-2026-11-21.md`, GDD decision log #24–#28), together
  with the load budgets, in-session pause and the 60 s full-efficiency window.
- **First-week pacing (2026-11-23, `sprint-change-proposal-2026-11-23.md`, Epic 9).** No new primitive and no
  ADR needed; the decisions fit D1, D2, D11 and D12:
  - The nest scene's camera steps (D11) are replaced by framing to the rooms dug; `selectNestView` gains the
    rooms dug and dig progress. The dot cloud and the 50-ant cap stay.
  - DIG and FEED are `actions/` intents (`Result`), not tick logic; diggers' own digging and bought auto-dig
    run in `processTick` and must be step-length independent (D2 property test).
  - Batch 2 crowding (replacing `workerEfficiency`) and starvation are pure formulas of the current state, so
    macro-step catch-up matches live play; the offline starvation floor (offline-only rule) moves from 50% to 80% kept.
  - `getNextAction` no longer drives NEST from Colony on, or the offline summary (PR #439); WRKR, the tab dots
    and the sim policy still use it.
  - The sim (D12) gains a first-week schedule and payoff probes; the three gates are report verdicts, never CI asserts.

## Cross-cutting Concerns

These patterns apply to ALL systems and must be followed by every implementation.

Findings that shaped this section (code at `main` @ a332d82, 2026-11-21): `EventBus` silently drops
listener errors in the browser (its `process.env` development check never passes in a Vite build);
`SwarmEvents` is an untyped `[key: string]: unknown` map with ~45 event names; 11 direct `console.*`
calls in `src/`.

### Error Handling

**Strategy:** pure systems don't throw for expected outcomes; boundaries catch everything else.

| Kind | Example | Handling |
|---|---|---|
| Expected outcome | can't afford, no free workers, 3 of 3 out | Return a result (`{ ok: false, reason }`) or an unchanged state. Never throw. The UI shows the reason. |
| Recoverable fault | save write fails, storage full, bad import file | Caught at the platform boundary; the player sees the UX state (`• SAVE FAILED`, `THAT FILE ISN'T A SWARM SAVE.`). |
| Unexpected exception in the tick | a bug in a system | Caught once per tick in `GameLoop`. The tick's write is discarded (state stays at the last good snapshot) and the error is logged. After 3 consecutive failed ticks the simulation pauses and a sheet offers EXPORT SAVE and RELOAD. |
| Corrupt save / failed migration | parse error, migration throws | `load()` status → corrupt-save sheet (D4). Never a silent reset. |
| Event listener error | a UI callback throws | `EventBus` isolates it and **always** logs it via `log.error`. |

Errors never wipe or overwrite a good save. The last good snapshot is what gets saved.

**Example:**

```ts
// Expected outcome: a result, not an exception
export function buyBuilding(s: GameState, id: BuildingId): Result<GameState> {
  const cost = getBuildCost(id, s.buildings[id].level);
  if (!canAfford(s, cost)) return { ok: false, reason: 'cannot_afford' };
  return { ok: true, value: { ...s, resources: spend(s.resources, cost), buildings: levelUp(s.buildings, id) } };
}

// Tick boundary (GameLoop)
try {
  next = processTick(prev, ctx, dt);
  failures = 0;
} catch (e) {
  log.error('tick', 'tick failed; state kept', e);
  next = prev;
  if (++failures >= 3) pauseWithErrorSheet();
}
```

### Logging

**Format:** plain console output prefixed by scope (`[scope] message`), plus structured detail objects.
**Destination:** the browser console, plus an in-memory ring buffer (last 200 entries) included by
"Export diagnostics" in Settings. No network.

**Log levels:**
- `error`: a bug or a lost operation. Always on.
- `warn`: unexpected but handled (backup loaded, migration step skipped). Always on.
- `info`: milestones (save loaded, resume of N ms, phase committed). Dev builds and `?debug=1`.
- `debug`: diagnostics. Dev builds only; stripped from production via `import.meta.env.DEV`.

**Rules:**
- Only `src/utils/log.ts` calls `console.*` (enforced with oxlint `no-console`; the 11 current calls migrate).
- Nothing is logged per tick or per frame, except `debug` behind a sampling counter.
- Offline catch-up logs one summary line, not one per step.

**Example:**

```ts
import { log } from '../utils/log';
log.info('resume', 'caught up', { elapsedMs, steps, efficiency });
log.warn('save', 'primary unreadable; loaded backup', { slot: 'bak1' });
```

### Configuration

| Type | Lives in | Notes |
|---|---|---|
| Game constants (tick length, base caps, max tabs) | `src/data/constants.ts` | `as const`; rarely change |
| Balance values (costs, rates, event timers) | `src/data/balance/*.ts`, one file per system | Typed `as const` objects, not JSON, so types and tree-shaking work. Guard targets live in `transitions.ts` (D3). Tests import these values; they never re-type numbers. |
| Content tables (decision events, critical-path items, enemy types, tab registry) | `src/data/content/*.ts` | Data, not code paths (D7, D8) |
| Player settings | `src/platform/settings.ts`: one signal, own localStorage key, own version | Outside the save (D4) |
| Platform capabilities (vibrate, standalone, notifications) | `src/platform/capabilities.ts` | Detected once at boot; features degrade, never crash |

No remote config.

### Event System

**Pattern:** the existing `EventBus`, typed, for notifications only (narrative, audio, haptics, log
lines, UI juice). **State is the authority; events never are.**

**Rules:**
- One `SwarmEvents` interface in `src/engine/events.ts` lists every event and its payload type. No
  string index signature; emitting an unknown event fails typecheck.
- Naming: `snake_case`, `noun_verb` in the past tense (`battle_completed`, `phase_committed`), matching
  the current names. The two `colon:style` names (`state:changed`, `click:egg`) migrate.
- Synchronous. Events raised during a tick are queued and flushed **after** that tick's state write,
  so listeners always see the new state.
- Offline catch-up and `src/sim/` run with a collecting bus: nothing plays or animates. The offline
  summary is built from the before/after states, not from events.
- No listener writes game state. A listener that needs a state change calls an action, which writes
  between ticks.

**Example:**

```ts
// events.ts
export interface SwarmEvents {
  battle_completed: { outcome: 'victory' | 'defeat' | 'draw'; cause: BattleCause };
  phase_committed: { from: Phase; to: Phase };
  decision_spawned: { id: DecisionId };
}

// a system, inside the tick
ctx.events.push('battle_completed', { outcome, cause });

// GameLoop, after gameState.value = next
ctx.events.flushTo(bus);
```

### Debug Tools

| Tool | Dev build | Production with `?debug=1` |
|---|---|---|
| Overlay: FPS, tick time (p50/p95), catch-up time, seed, save version | yes | yes, read-only |
| State inspector (current state as collapsible JSON) | yes | yes, read-only |
| Log viewer (ring buffer) | yes | yes |
| Cheat commands (`window.__swarm`: add resources, set phase, time-skip N hours, set seed) | yes | no |
| Export diagnostics (logs + state + seed + build hash) | yes | yes (also in Settings for everyone) |

**Activation:** the overlay toggles with the backtick key or a 3-finger long-press, in dev builds and
with `?debug=1`. Cheats exist only in dev builds (`import.meta.env.DEV`) and are tree-shaken from
production. E2E tests keep seeding saves; they don't depend on cheats.

### Dependency Hygiene

- Dependabot alerts in this repo are development-scope (Vite, Vitest, undici and their
  transitive packages). None ship to players.
- **Runtime dependencies stay minimal:** `preact`, `@preact/signals`, `@preact/signals-core` (plus the
  PWA runtime). Adding one needs an ADR.
- Dev dependencies get weekly grouped Dependabot PRs. CI is the gate; auto-merge applies as for any PR.
- A story adds `pnpm audit --prod --audit-level=high` as a step inside an existing CI job (no new job
  key, so branch protection is unaffected).

## Project Structure

### Organization Pattern

**Pattern:** hybrid. Layers at the top of `src/` (engine, state, systems, UI…), features inside the UI
layer (one folder per tab).

**Rationale:** the simulation is shared by the game, offline catch-up and the headless pacing harness,
so it must stay a DOM-free layer. The UI is where features change most (5 tabs, sheets, scenes), so it
is grouped by feature. The prototype already uses this top-level split; the rework adds layers rather
than moving them.

### Directory Structure

```
the-swarm/
├── src/
│   ├── main.tsx                 # Boot only: load save, resume(), mount the UI, start GameLoop
│   ├── engine/                  # Ticker, GameLoop, resume(), EventBus + events.ts, ProgressionCurve
│   ├── state/                   # GameState types, gameSignal, selectors.ts, createInitialState
│   ├── actions/                 # Player intents (assignWorkers, buyBuilding, continuePhase…): validate, write state between ticks
│   ├── systems/                 # Pure per-tick rules (ResourceSystem, BattleSystem, DecisionSystem…)
│   ├── phases/                  # transitions.ts (only source of guards), PhaseStateMachine (evaluate/commit), phase content
│   ├── persistence/             # SaveManager (load status), migrations.ts, save schema types
│   ├── platform/                # Interfaces + web implementations: audio, haptics, notifications, storage, lifecycle, settings, capabilities
│   ├── sim/                     # Headless pacing harness: player policy, check-in schedule, reachability, report
│   ├── data/
│   │   ├── constants.ts
│   │   ├── balance/             # One file per system: costs, rates, timers (as const)
│   │   └── content/             # Decision events, enemy types, critical-path tables, tab registry, planets, prestige tree
│   ├── utils/                   # format.ts, math.ts, rng.ts (seeded PRNG), log.ts, result.ts
│   ├── debug/                   # Overlay, state inspector, log viewer; cheats (dev build only)
│   └── ui/
│       ├── App.tsx              # Root: strip, active tab, tab bar, SheetHost, OverlayHost
│       ├── shell/               # TabBar, ResourceStrip, GoalMeter, PrimaryZone, SheetController, OverlayHost, desktop rail
│       ├── tabs/
│       │   ├── nest/            # NEST tab (Phase 1 lay egg, next action, event lines, Click Power card)
│       │   ├── wrkr/            # Role rows, upkeep, automation targets
│       │   ├── build/           # Buildings, research, converter
│       │   ├── front/           # war/, map/, stars/ segments
│       │   └── log/             # Chronicle, lifetime stats, settings, legacy/
│       ├── sheets/              # OfflineSummary, DecisionSheet, BattleSummary, ResourceSheet, CorruptSave, peek sheets
│       ├── overlays/            # PhaseReveal, TitleCinematic, TranscendenceEnding, Paused
│       ├── scenes/              # NestScene, MapGrid, StarMap (SVG), plus their animation loop
│       ├── primitives/          # Button, Stepper, HoldToConfirm, Meter, Card, Toast, CoachMark, Value
│       ├── glyphs/              # The 20 resource/building glyphs + gear, as TSX SVG components
│       └── styles/              # tokens.css (DESIGN.md tokens), base.css, layout.css, per-component CSS modules
├── public/                      # PWA icons, manifest assets (no game assets)
├── tests/
│   ├── unit/                    # Mirrors src/ (new tests); legacy flat files move when touched
│   ├── arch/                    # architecture.test.ts: import-boundary rules (below)
│   ├── sim/                     # Reachability (CI) and pacing report (pnpm sim, not CI)
│   ├── perf/                    # Catch-up budget, scene frame budget
│   ├── e2e/                     # Playwright specs (kebab-case.spec.ts) + helpers/ (seeds, intro flag)
│   ├── saves/                   # Save fixtures per shipped version (migration tests)
│   └── snapshots/
├── docs/
│   ├── decisions/               # ADRs (0001-…md)
│   └── agents/                  # Agent workflow docs (existing)
├── _bmad-output/planning-artifacts/   # Brief, GDD, UX, architecture
└── vite.config.ts, vitest.config.ts, playwright.config.ts, tsconfig.json, package.json, pnpm-lock.yaml
```

Removed by the rework: `src/state/StateManager.ts`, `src/state/Store.ts`, `src/state/GameStatePool.ts`
(D5); `src/ui/UIRoot.ts` and `src/ui/panels/*` (replaced by `ui/shell` + `ui/tabs` as each panel is
migrated); `package-lock.json` (stale; the repo is pnpm-only).

### System Location Mapping

| System | Location | Responsibility |
|---|---|---|
| Simulation clock, resume | `src/engine/Ticker.ts`, `GameLoop.ts`, `resume.ts` | Fixed 20 Hz step, visible-only, single resume path (D1) |
| Offline catch-up | `src/engine/resume.ts` + `src/systems/OfflineProgression.ts` | Macro-steps, cap, efficiency, starvation floor (D2) |
| Game state + selectors | `src/state/` | One signal, `computed` slices (D5) |
| Player actions | `src/actions/` | Validate intent, return `Result`, write state between ticks |
| Economy, pipelines, roles | `src/systems/ResourceSystem.ts` | Integer resources, eggs → larvae → workers |
| Combat | `src/systems/BattleSystem.ts`, `SoldierSystem.ts`, `EnemySystem.ts` | Auto-battle, enemy traits, battle cause |
| Scouts/warriors, expeditions | `src/systems/RecruitmentSystem.ts`, `ExpeditionSystem.ts` | Separate from combat soldiers (existing rule) |
| Decision events | `src/systems/DecisionSystem.ts` + `src/data/content/decisions.ts` | Spawn on session clock, `applyChoice` (D8) |
| Next action | `src/systems/NextAction.ts` | Pure `getNextAction(state)` for WRKR, the tab dots and the sim policy (NEST shows DIG from Colony; the offline summary has no action since PR #439) |
| Phase flow | `src/phases/transitions.ts`, `PhaseStateMachine.ts` | Conditions, evaluate/commit, latch (D3) |
| Prestige | `src/systems/PrestigeSystem.ts`, `src/data/content/prestigeTree.ts` | Full wipe rules (E5) |
| Saves and migrations | `src/persistence/` | Load status, numbered migrations (D4) |
| Settings | `src/platform/settings.ts` | Own key, outside the save |
| Audio, haptics, notifications | `src/platform/{audio,haptics,notifications}/` | Interfaces + web implementations (D9) |
| Seeded RNG | `src/utils/rng.ts` | PRNG state lives in `GameState` (D6) |
| Logging | `src/utils/log.ts` | Only place that calls `console.*` |
| Tabs and sheets | `src/ui/shell/`, `src/ui/tabs/*`, `src/ui/sheets/` | Tab registry, SheetController (D7) |
| Scenes | `src/ui/scenes/` | SVG nest, map, star map (D11) |
| Pacing harness | `src/sim/`, `tests/sim/` | Reachability gate, pacing report (D12) |
| Debug tools | `src/debug/` | Overlay, inspector; cheats dev-only |
| PWA | `vite.config.ts` (vite-plugin-pwa), `public/` | Manifest, service worker (D10) |

### Naming Conventions

#### Files
- Class or component modules: `PascalCase` (`BattleSystem.ts`, `NestTab.tsx`, `DecisionSheet.tsx`).
- Function/data modules: `camelCase` (`selectors.ts`, `transitions.ts`, `format.ts`, `rng.ts`).
- `.tsx` only for files that contain JSX; everything else `.ts`.
- Unit tests: `<SourceName>.test.ts(x)`, mirroring the source path under `tests/unit/`.
- E2E specs: `kebab-case.spec.ts` (existing convention).
- ADRs: `docs/decisions/NNNN-kebab-title.md` (repo convention, `docs/agents/domain.md`).

#### Code Elements

| Element | Convention | Example |
|---|---|---|
| Types, interfaces, components | PascalCase | `GameState`, `Transition`, `GoalMeter` |
| Functions, variables | camelCase | `getNextAction`, `assignWorkers`, `elapsedMs` |
| Module-level constants | UPPER_SNAKE | `TICK_MS`, `MAX_TABS` |
| Balance/content objects | camelCase `as const` | `buildingCosts`, `decisionEvents` |
| Selectors | `select` + noun | `selectWorkers`, `selectGoalProgress` |
| Actions | imperative verb | `buyBuilding`, `continuePhase` |
| Events | snake_case past tense | `battle_completed`, `phase_committed` |
| String-literal IDs | snake_case | `'chitin_armory'`, `'beetle_sighting'` |
| DOM test hooks | `data-*`, kebab-case values | `data-action="continue"`, `data-tab="wrkr"`, `data-stat="resources.eggs"` |
| CSS classes | kebab-case, component-scoped | `.goal-meter__row` |
| Storage keys | `the_swarm_` prefix | `the_swarm_save`, `the_swarm_settings`, `the_swarm_intro_seen` |

Existing `data-stat` / `id` selectors used by E2E specs are kept when components migrate.

#### Game Assets
- No binary game assets: glyphs and scenes are TSX SVG components; audio is synthesized.
- Glyph components: `Glyph` + resource or building name (`GlyphChitin`, `GlyphBarracks`).
- Design tokens are CSS custom properties named as in DESIGN.md (`--color-accent`, `--space-2`).

### Architectural Boundaries

Import rules, enforced by `tests/arch/architecture.test.ts` (scans import statements; no new dependency):

1. `systems/`, `phases/`, `state/`, `data/`, `sim/`, `utils/` import **no** DOM APIs, no `ui/`, no
   `platform/`, no `debug/`. They run in Node for tests and the harness.
2. `ui/` reads state only through `state/selectors.ts` and changes it only through `actions/`. It never
   imports `systems/` directly and never writes `gameState.value`.
3. `actions/` may call `systems/` and write `gameState` (between ticks). Only `engine/GameLoop` writes
   during a tick.
4. `platform/` imports only types from the game layers; game layers reach platform services only
   through interfaces passed in at boot.
5. `debug/` may read anything; nothing imports `debug/` except `main.tsx`, behind `import.meta.env.DEV`
   or `?debug=1`.
6. Phase-guard thresholds exist only in `phases/transitions.ts`; balance numbers only in `data/balance/`.

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents. Where a choice could be made two
ways, this section picks one.

### Novel Patterns

#### N1. Countable-Ant Nest Scene

**Purpose:** show the colony as real, countable ants (Pillar 1) from 1 ant to thousands, within the
frame budget, without the scene ever becoming the source of truth for numbers.

**Components:**
- `selectNestView` (selector): derives a `NestView` from state at ≤ 4 Hz: per-chamber counts (eggs,
  larvae, workers by role), queen state, starving/at-capacity flags, camera scale step.
- `nestLayout` (pure function): `NestView` → chamber geometry, anchor points and the split between
  `individuals` (≤ 50 ants) and `cloudCount` per chamber. Deterministic for a given view (seeded by chamber id).
- `NestScene` (Preact SVG component): renders soil, tunnels, chambers, the queen, individual ants and
  one dot-cloud `<path>` per chamber.
- `useSceneClock` (animation loop): one rAF loop for all scenes; moves individual ants along tunnel
  paths; paused when hidden or under reduced motion.
- `ChamberLabels` (HTML overlay): exact integer counts at chamber anchors (DESIGN.md: HTML, not SVG text).

**Data flow:**

```
gameState ──(selectNestView, ≤4 Hz)──▶ NestView ──(nestLayout)──▶ geometry + individuals + cloud
                                                       │
                     useSceneClock (rAF, visual only) ─┴─▶ NestScene (SVG) + ChamberLabels (HTML)
```

**Rules:**
- The scene never reads `gameState` directly and never writes anything. Numbers shown as text come
  from selectors, never from counting drawn ants.
- Individual ants are visual tokens, not entities: there is no per-ant state in `GameState`.
- Camera scale steps (2× / 1.5× / 1×) and the cloud threshold come from `data/balance/scene.ts`.
- Accessibility: the scene root is a labelled group ("Nest: 37 workers, 5 eggs, 4 larvae"); chambers
  are labelled buttons that open the chamber peek sheet.

**Implementation guide:**

```tsx
export function NestScene() {
  const view = useThrottledSignal(selectNestView, 250);       // ≤ 4 Hz
  const layout = useMemo(() => nestLayout(view.value), [view.value]);
  const t = useSceneClock();                                   // visual time only
  return (
    <svg role="group" aria-label={nestAriaLabel(view.value)} viewBox={layout.viewBox}>
      <Soil /><Tunnels paths={layout.tunnels} />
      {layout.chambers.map(c => (
        <Chamber key={c.id} chamber={c}>
          <DotCloud count={c.cloudCount} bounds={c.bounds} seed={c.id} />
          {c.individuals.map(a => <Ant key={a.id} pose={antPose(a, t.value)} />)}
        </Chamber>
      ))}
    </svg>
  );
}
```

**Usage:** the same split (selector → pure layout → dumb SVG + HTML labels) applies to `MapGrid` and `StarMap`.

#### N2. Pacing Harness

**Purpose:** prove "no soft-locks" in CI and measure pacing against the GDD targets, using the real
game rules with no DOM.

**Components:**
- `SimRunner` (`src/sim/runner.ts`): owns a `GameState` and a seed; advances time only through
  `resume(elapsedMs)` (D1/D2) and applies player moves only through `actions/`.
- `CheckInSchedule`: a list of real-time gaps (for example 6 check-ins a day with overnight gaps).
- `PlayerPolicy`: a pure function `(state) → Action[]` applied at each check-in. The default is
  "follow `getNextAction`, rebalance roles, CONTINUE when the goal is met".
- `Probes`: record phase entry times, check-in length in actions, decisions available per check-in.
- Two entry points: `checkReachability(phase)` (CI) and `runPacingReport()` (`pnpm sim`, prints a table).

**Data flow:**

```
seed + initial state ─▶ SimRunner ─(gap)─▶ resume() ─▶ PlayerPolicy(state) ─▶ actions ─▶ Probes
                               ▲                                                         │
                               └──────────────────── next gap ◀──────────────────────────┘
```

**Rules:**
- The harness uses exactly the code the game uses: no sim-only shortcuts, no mocks of systems.
- Decision events don't fire in the harness (they never fire offline); a policy that answers them is
  a later extension.
- The CI test asserts an invariant: "from the start of phase P, the guard of P is met within the
  simulated budget, without prestige." The budget is a generous ceiling (for example 10× the GDD
  target), not the target itself, so balance tuning doesn't break CI.

**Implementation guide:**

```ts
// tests/sim/reachability.test.ts
it.each(MVP_PHASES)('%s guard is reachable from its own production', (phase) => {
  const result = checkReachability(phase, { seed: 1, policy: defaultPolicy, ceilingDays: 30 });
  expect(result.reached).toBe(true);
  expect(result.prestiged).toBe(false);
});
```

#### N3. Persistent Paused Decision Event

**Purpose:** a decision event survives backgrounding and closing the app with its timer paused, so
closing the app is never a free escape (EXPERIENCE.md), while events still never spawn offline.

**Components:**
- `state.decision`: `{ open: { id, remainingMs, openedAtSessionMs } | null, nextSpawnSessionMs }`,
  part of the save.
- `DecisionSystem.tick(state, ctx, dt)`: foreground only. Spawns on the session clock, counts down
  `remainingMs` on game time, applies the ignore outcome on timeout through `applyChoice`.
- `DecisionSheet`: renders `state.decision.open`; its buttons call `actions.chooseDecision`.
- `SheetController`: shows the sheet only when no higher-priority sheet or overlay is up.

**Lifecycle:**

```
(foreground ≥ 2 min this session) ─▶ spawn ─▶ open (timer counts down on game time)
     open ──hide/close──▶ saved with remainingMs ──resume──▶ reopens after the offline summary
     open ──choice──▶ applyChoice ─▶ closed      open ──timeout (free/costly)──▶ applyChoice('ignore')
     unavoidable: no timer, no dismiss
```

**Rules:**
- Offline catch-up skips `DecisionSystem.tick` entirely: no spawns, no countdown.
- On a new session, `nextSpawnSessionMs` resets to now + 2–3 min of foreground play (seeded RNG).
- The countdown never runs while the sheet is waiting behind another sheet or overlay.

### Communication Patterns

**Pattern:** state for facts, actions for intents, events for notifications, a context for dependencies.

- **Systems** receive a `TickContext` argument (`{ rng, events, balance, dtSec }`) instead of importing
  singletons. No `new SomeSystem(bus)` constructors holding references; systems are modules of pure functions.
- **UI → game:** call an action. **Game → UI:** selectors (state) and events (one-off juice).
- **Platform services** are passed in once at boot (`createGame({ storage, audio, haptics, lifecycle })`).

**Example:**

```ts
// actions/workers.ts
export function assignWorkers(role: Role, n: number): Result<void> {
  const r = ResourceSystem.assign(gameState.value, role, n);     // pure
  if (!r.ok) return r;
  gameState.value = r.value;                                      // between ticks
  return { ok: true, value: undefined };
}
```

### Entity Patterns

**Creation:** plain data objects made by pure factory functions; no classes for game data, no pooling.

- `createInitialState()`, `createExpedition(...)`, `createEnemy(battlesWon, rng)` return plain,
  JSON-serializable objects (everything in `GameState` must survive `JSON.stringify` → `parse`).
- IDs are snake_case string literals from content tables, or sequential integers for runtime instances
  (`state.nextId`). No `Math.random` IDs, no UUIDs.

**Example:**

```ts
export function createEnemy(battlesWon: number, rng: Rng): [Enemy, Rng] {
  const [type, rng2] = pick(rng, enemyTypes);                   // content table
  return [{ type: type.id, ...scaleEnemy(type.base, battlesWon) }, rng2];
}
```

### State Patterns

**Pattern:** discriminated unions for anything with a lifecycle; the phase FSM for phases; no loose
boolean flags.

- Expeditions, explorations, research, battles: `{ status: 'idle' } | { status: 'running', ... }
  | { status: 'done', result }`. Times are game time in ms, never wall clock (D1).
- The phase is changed only by `PhaseStateMachine.commit` (or prestige). Nothing else assigns `state.phase`.
- Every state write is a spread; nested objects are spread at each changed level.

**Example:**

```ts
type Research =
  | { status: 'idle' }
  | { status: 'running'; projectId: ResearchId; progressMs: number; durationMs: number }
  | { status: 'done'; projectId: ResearchId };
```

### Data Patterns

**Access:** import typed `as const` modules from `data/`; look up content by ID through typed helpers.

```ts
import { buildingCosts } from '../data/balance/buildings';
import { getDecision } from '../data/content/decisions';

const cost = getBuildCost(buildingCosts[id], level);   // never re-type the numbers
const event = getDecision('beetle_sighting');           // typed ID; throws in dev if missing
```

### Units and Integers

- **Durations** are in milliseconds, named with an `Ms` suffix (`hatchMs`, `timerMs`). Rates are per
  second, named `PerSec`. Ticks never appear in balance data. This resolves the tick-unit ambiguity
  flagged in the GDD.
- **Resources** are integers at rest. Fractional accumulation lives only in pipeline `progress` fields
  and `*Remainder` fields; amounts are floored when credited or spent. Display uses `formatInt`, which
  floors and never rounds up.
- A property test checks, after random ticks and catch-ups, that every value in `state.resources` is
  `Number.isInteger` and ≥ 0.

### UI Component Patterns (Preact)

- Function components only. A component reads selectors (`selectX.value`) and calls actions; it never
  reads `gameState.value`.
- Local UI state (open segment, hold progress) uses `useSignal`; it goes into `GameState` only if it
  must survive a reload (then into settings or the save, per D4).
- Every interactive element has a stable `data-*` hook for E2E (`data-action`, `data-tab`, `data-role`).
- Primitives from `ui/primitives/` replace raw elements for buttons, steppers, meters and
  hold-to-confirm, so the accessibility floor and the flash rule are implemented once.

```tsx
export function RoleRow({ role }: { role: Role }) {
  const count = selectRoleCount(role);                    // computed slice
  return (
    <li class="role-row" data-role={role}>
      <span>{roleLabel(role)}</span>
      <Stepper value={count} canAdd={selectFreeWorkers.value > 0}
               onStep={(n) => assignWorkers(role, n)} label={roleLabel(role)} />
    </li>
  );
}
```

### Save Migration Pattern

```ts
// persistence/migrations.ts: one function per version, never renumbered
migrations[14] = (save: SaveV13): SaveV14 => ({
  ...save,
  version: 14,
  phaseGoal: null,                         // D3 latch
  decision: { open: null, nextSpawnSessionMs: 0 },
});
// tests/unit/persistence: every fixture in tests/saves migrates to the current version and loads.
```

### Testing Patterns

- TDD: the failing test comes first, in the same PR.
- Unit tests build state with `makeState(overrides)` (wraps `createInitialState()`); never hand-write
  a full `GameState`.
- Assert invariants and relations (`toBeGreaterThan(before)`, `Number.isInteger`), never balance numbers.
  When a test needs a number, it imports it from `data/balance/`.
- Randomness: pass a fixed seed; assert outcome sets (`Victory | Defeat | Draw`), not one outcome.
- E2E: `seedSave(page, state, { introSeen: true })` before `page.goto('/')`; phase seeds satisfy the
  conditions in `transitions.ts`; phase changes happen by clicking `[data-action="continue"]`.

### Consistency Rules

| Pattern | Convention | Enforcement |
|---|---|---|
| State writes | One spread write per tick; actions write between ticks | `tests/arch` + review checklist |
| UI reads | Selectors only | `tests/arch` (no `gameState.value` under `ui/`) |
| Layer imports | Rules in Architectural Boundaries | `tests/arch/architecture.test.ts` |
| Randomness | Seeded `rng` in `systems/` and `sim/` | `tests/arch` (no `Math.random` there) |
| Logging | `log.*` only | oxlint `no-console` |
| Integers | Resources floored when credited or spent | Property test on resources |
| Units | `Ms` / `PerSec` suffixes in balance data | Code review; branded types where cheap |
| Phase thresholds | Only in `transitions.ts` | `tests/arch` (no guard numbers in `ui/`) |
| Saves | One numbered migration per schema change; a fixture per shipped version | Migration test over `tests/saves/` |
| Events | Typed in `events.ts`, flushed after the tick write | Typecheck |
| Test hooks | `data-*` on every interactive element | E2E specs |

## Architecture Validation

### Validation Summary

| Check | Result | Notes |
|---|---|---|
| Decision Compatibility | Pass | Web stack + Preact + signals; visible-only clock, macro-step catch-up and the pacing harness share one `resume()` path; no conflicting decisions |
| GDD Coverage | Pass | All 15 core systems from Project Context map to a location and a decision; each technical requirement has an owner (table below) |
| Pattern Completeness | Pass | Entity creation, communication, state, errors, data access and events defined with examples; 3 novel patterns documented |
| Epic Mapping | Pass | E1–E8 mapped (table below) |
| Document Completeness | Pass | Stack with verified versions, decision table, full structure, cross-cutting concerns, patterns, naming; no placeholders |

### Requirement Coverage

| Requirement (GDD) | How addressed |
|---|---|
| Fast first load (no hard target since 2026-11-21) | Precached PWA, minimal runtime deps, text first then scene fade-in (D10, D11) |
| Tap response < 100 ms, 60 FPS | Preact slice subscriptions (D5), scene loop with ≤ 4 Hz reads (D11) |
| Outcomes independent of frame rate | Fixed 20 Hz step; frame gaps > 1 s go to `resume()` (D1) |
| 12–24 h catch-up < 500 ms | Macro-steps (D2); deterministic step budget in CI, timing on the reference phone |
| No background processing | Visible-only simulation; save on hide (D1) |
| Integer resources | Units and Integers pattern + property test |
| Save migration from every shipped version | Numbered migrations + a fixture per version (D4) |
| Accessibility floor | DOM-first UI; primitives implement it once (Engine & Framework, UI patterns) |
| Zero soft-locks | Reachability gate in CI (D12, N2) |

### Epic Mapping

| Epic | Location | Key decisions / patterns |
|---|---|---|
| E1 Mobile shell | `ui/shell`, `ui/tabs/*`, `ui/sheets`, `ui/primitives` | D7, UI component patterns, Preact adoption steps |
| E2 Offline and check-in | `engine/resume.ts`, `systems/OfflineProgression.ts`, `ui/sheets/OfflineSummary` | D1, D2, D9 (no web notifications), next-action selector |
| E3 Pacing pass | `sim/`, `tests/sim`, `data/balance/` | D6, D12, N2, Units and Integers |
| E4 Phase depth | `data/content/`, `systems/DecisionSystem.ts`, `phases/transitions.ts` | D3, D8, N3, Entity and State patterns |
| E5 Prestige rework | `systems/PrestigeSystem.ts`, `persistence/migrations.ts` | D4 (wipe migration, `phasesCompleted`), Save Migration pattern |
| E6 Phases 4–5 on mobile | `ui/tabs/front/{map,stars}`, `ui/scenes/MapGrid`, `StarMap` | N1 split reused, D7 peek sheets |
| E7 Transcendence | `ui/overlays/TranscendenceEnding`, `phases/` | D3 commit, D7 overlay layer |
| E8 Art and audio | `ui/glyphs`, `ui/styles/tokens.css`, `platform/audio` | D9, D11 |

### Coverage Report

**Systems covered:** 15/15
**Patterns defined:** 9 standard + 3 novel
**Decisions made:** 13 (D1–D13) + stack and distribution

### Issues Resolved

1. Load budgets: the 2 MB download limit and the 3 s first-interactive target dropped as hard constraints (owner).
2. Pause is in-session only; hiding or closing the app ends it (owner).
3. Visible frame gaps > 1 s go to `resume()` instead of being dropped.
4. `lifetime.phasesCompleted` added for the Phase Skip rule.
5. Perf gates made deterministic in CI; timings measured on the reference phone.
6. Context7 accepted, with setup steps (owner).

### Validation Date

2026-11-21

## Development Environment

### Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite 8)
- pnpm 11 (pinned through `packageManager` in `package.json`; enable with `corepack enable`)
- Playwright Chromium (`pnpm exec playwright install chromium`)
- Network access to `registry.npmjs.org` and the Playwright browser hosts (also needed by scheduled
  agent sessions; see #197)

### AI Tooling (MCP Servers)

| MCP Server | Purpose | Install Type |
|---|---|---|
| Context7 (upstash/context7) | Current docs for Vite 8, Preact 11, Vitest 5, signals, vite-plugin-pwa | Local (`npx`) or remote (HTTP) |

**Setup:** the repo's `.mcp.json` configures the remote Context7 server for every Claude Code session
in the repo, with no key (free tier). Sessions need `mcp.context7.com` on their network allowlist
(added for the cloud environment on 2026-11-21).

To use a personal API key (higher rate limits), add it to your own user config instead, never to the repo:

```bash
claude mcp add --scope user --header "CONTEXT7_API_KEY: <your key>" --transport http context7 https://mcp.context7.com/mcp
```

No engine-specific MCP applies (no engine).

### Setup Commands

```bash
git clone https://github.com/Seven74AI/the-swarm.git
cd the-swarm
pnpm install
pnpm exec playwright install chromium
pnpm test:all      # typecheck + unit + e2e
pnpm dev
```

### First Steps

1. Run `gds-create-epics-and-stories` with the GDD, UX and this document as input; each story
   becomes one `needs-triage` GitHub issue (CLAUDE.md).
2. Start with the foundation stories that unblock everything else: remove `COLONY_TO_EXPANSION`;
   typed `SwarmEvents` + `log.ts`; `tests/arch` boundary test; delete `StateManager`/`Store`/`GameStatePool`;
   add Preact + JSX config with the single-`signals-core` check; delete `package-lock.json`.
3. Configure Context7 per the AI Tooling instructions above.
4. Then the time model (D1/D2) and phase flow (D3), which E1, E2 and E4 stories build on.
