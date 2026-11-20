---
title: 'Game Architecture'
project: 'the-swarm'
date: '2026-11-20'
author: 'Seven74'
version: '1.0'
stepsCompleted: [1, 2, 3]
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

**Steps Completed:** 3 of 9 (Initialize, Project Context, Engine & Framework)

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
