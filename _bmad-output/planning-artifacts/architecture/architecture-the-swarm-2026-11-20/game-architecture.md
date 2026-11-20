---
title: 'Game Architecture'
project: 'the-swarm'
date: '2026-11-20'
author: 'Seven74'
version: '1.0'
stepsCompleted: [1, 2, 3, 4, 5]
status: 'in-progress'
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

This architecture document is being created through the GDS Architecture Workflow.

**Steps Completed:** 5 of 9 (Initialize, Project Context, Engine & Framework, Architectural Decisions, Cross-cutting Concerns)

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

- First interactive in < 3 s on a ~2022 mid-range Android over 4G; initial download < 2 MB.
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
- *Godot / Unity web export:* WebAssembly payloads of tens of MB break the 3 s first-load target,
  web exports run much worse than native on phones, and accessibility is weak. It would need a full rewrite.
- *Phaser 4 / PixiJS 8 as the main renderer:* built for canvas-first games. PixiJS is kept as a
  fallback for the nest scene only, if SVG can't hold the frame budget at large colony sizes.
- *Stay on vanilla DOM (no UI library):* viable, but every agent hand-rolls components, and
  drift between panels is already visible in the prototype.

**Note on the size budget (owner, 2026-11-21):** the GDD's 2 MB download limit is not treated
as a hard constraint. The 3 s first-interactive target still applies.

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

- **Context7** (upstash/context7, MCP docs lookup) is recommended so agents check current
  Vite 8, Preact 11 and Vitest 5 docs instead of relying on training data. Owner to confirm.
  No engine-specific MCP applies (no engine).

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
12. Dependency hygiene (73 Dependabot alerts on `main` at the time of writing).

## Architectural Decisions

### Decision Summary

| # | Category | Decision | Version | Rationale |
|---|---|---|---|---|
| D1 | Time model | 20 Hz fixed tick while visible; save and stop on hide; one `resume(elapsedMs)` for cold start and return; gaps < 60 s at full efficiency | n/a | Browsers suspend hidden tabs; one path is testable; no penalty for glancing away (owner) |
| D2 | Offline catch-up | Macro-steps through the same `processTick` | n/a | Fits 12–24 h in < 500 ms with one simulation code path |
| D3 | Phase flow | Conditions declared in `transitions.ts`; pure `evaluate()` + `commit()` on CONTINUE; latched goal | n/a | UX GOAL MET / CONTINUE; UI never restates thresholds |
| D4 | Persistence | localStorage behind `SaveStore`; load status; persistent-storage request; settings outside the save | n/a | Works today, swappable for Capacitor, never fails silently |
| D5 | State | Single signal, one spread write per tick, `computed` selectors; delete `StateManager`, `Store`, `GameStatePool` | signals-core 1.x | Fixes #186 at the root; removes primitives agents copy |
| D6 | Randomness | Seeded PRNG, state stored in game state | n/a | Reproducible simulations and bug replays (owner) |
| D7 | UI shell | Tab registry + single `SheetController` + overlay layer | Preact 11.x | 23 panels → 5 tabs; sheets never stack |
| D8 | Decision events | Session foreground clock; data-declared ignore policy; open event persisted | n/a | Fixes spawn-on-load; closing the app is no escape |
| D9 | Platform services | `src/platform/` interfaces, web implementations now, Capacitor later; no notifications on web | Capacitor 8.x (later) | Store build stays possible; the web cannot detect events while closed (owner) |
| D10 | Distribution / PWA | vite-plugin-pwa, precache everything, update on next cold start, `display: standalone` | vite-plugin-pwa ≥ 1.3 | Offline play, home-screen storage exemption, no mid-session reloads |
| D11 | Scene rendering | SVG, ≤ 50 animated ants, dot cloud as one path, own rAF loop with ≤ 4 Hz slice reads | n/a | Frame budget on low-end phones, with a measured fallback |
| D12 | Pacing harness | Headless `src/sim/`; reachability gates CI; duration targets are a report only | n/a | Soft-lock rule enforced; no balance numbers in tests |
| D13 | Dependency hygiene | Policy set in Cross-cutting Concerns | n/a | 73 Dependabot alerts on `main` (2026-11-20) |

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

### Offline Catch-up (D2)

- Runs the same `processTick` systems with a macro-step `dt` (initial value 10 s; tuned by the perf test).
- Systems must be correct for any step length: rates × `dt`, integer flooring where amounts are spent
  or displayed, every pipeline exit feeding the next pipeline (existing rule).
- Offline-only rules apply inside catch-up: the efficiency multiplier, the starvation floor (workers never
  below 50% of the pre-absence count), no decision events, no phase commits (the latch may set).
- **Tests:** a property test compares macro-step with fine-step results within a tolerance on random
  seeded states and checks the invariants (integers, never above capped production, starvation floor).
  A perf test enforces the 500 ms budget on a 24 h absence.

### Phase Flow (D3)

- `Transition` gains `conditions: { id, label, current(s), target(s) }[]`; `guard` is derived as
  all-met. `transitions.ts` stays the only source of thresholds.
- `PhaseStateMachine` splits into `evaluate(state) → Transition | null` (pure, every tick) and
  `commit(transition, state, bus)` (runs `onEnter`, emits `phase_changed`), called only from CONTINUE.
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
  time, the event log (last 100 lines), `lifetime.revealsSeen`, the PRNG state.
- **Outside the save** (own keys; survive prestige and import; not exported): settings, intro flag.
- **Migrations:** one numbered step per schema change, in order; two branches claiming the same
  version merge into one function (existing rule). The E5 prestige wipe is a normal step.

### State Management (D5)

- One `signal<GameState>`; one spread-based write per tick; user actions write between ticks.
- `src/state/selectors.ts` exports `computed` slices. Components and effects read only selectors,
  never `gameState.value` directly.
- Delete `StateManager`, `Store` (dead outside their own tests) and `GameStatePool` (allocates
  normally today; recycling would break selector reference equality).

### Randomness (D6)

- A small seeded PRNG (for example a 32-bit generator) with its state in `GameState`. Systems take it
  as input and return the advanced state; no `Math.random` in `src/systems` or `src/sim`.
- UI-only randomness (particles, wandering ants) may use `Math.random`.
- Tests keep asserting invariants (`Victory | Defeat`), but a seed can now reproduce a reported bug.

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
  Web implementations now; Capacitor implementations only when a store build is started.
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
- **Fallback trigger:** if p95 frame time on the reference device exceeds 16 ms in the perf test,
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

1. ADR-0001 Single game-state signal with `computed` selectors; delete the legacy state primitives (D5, #186).
2. ADR-0002 Visible-only simulation and the single resume path (D1, D2).
3. ADR-0003 Phase conditions, evaluate/commit and the latched goal (D3).
4. ADR-0004 Preact for the UI layer, web-first PWA, optional Capacitor (Engine & Framework, D9, D10).
5. ADR-0005 Seeded PRNG in game state (D6).

### Follow-ups for other planning artifacts

- GDD/UX: notifications are removed from the web build (Q2). Update the E2 notification story and
  EXPERIENCE.md Settings through `gds-correct-course` when the stories are written.

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

- As of 2026-11-21 all 73 Dependabot alerts are development-scope (Vite, Vitest, undici and their
  transitive packages). None ship to players.
- **Runtime dependencies stay minimal:** `preact`, `@preact/signals`, `@preact/signals-core` (plus the
  PWA runtime). Adding one needs an ADR.
- Dev dependencies get weekly grouped Dependabot PRs. CI is the gate; auto-merge applies as for any PR.
- A story adds `pnpm audit --prod --audit-level=high` as a step inside an existing CI job (no new job
  key, so branch protection is unaffected).
