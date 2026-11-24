---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/gdd.md
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/epics.md
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/decision-log.md
  - _bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md
  - docs/decisions/0001-single-state-signal-with-selectors.md
  - docs/decisions/0002-visible-only-simulation-and-resume.md
  - docs/decisions/0003-phase-conditions-and-continue.md
  - docs/decisions/0004-preact-ui-and-pwa-distribution.md
  - docs/decisions/0005-seeded-prng-in-state.md
  - _bmad-output/planning-artifacts/ux-designs/ux-the-swarm-2026-11-20/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-the-swarm-2026-11-20/EXPERIENCE.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-11-21.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-11-23.md
scope: "MVP stories (E1–E5, the MVP part of E8, and E9 batch 1); E6 and E7 stay epic stubs"
baseline_code: "Seven74AI/the-swarm main @ 1a79c18"
---

# the-swarm - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the-swarm, decomposing the requirements from the GDD, UX Design if it exists, and Architecture requirements into implementable stories.

**Every story is written to be implemented unattended by an agent** (owner decision, 2026-11-21). Where a story needs new content or tuning (new events, upgrades, narrative lines, balance values), the agent designs it inside the story's constraints, and the PR description and story file record what was added and why. No story waits on a human design pass.

Each story becomes one `needs-triage` GitHub issue (CLAUDE.md → *Planning with BMAD*). Story status lives in GitHub, not here. Source code stays authoritative for current behaviour; phase guards live only in `src/phases/transitions.ts`.

## Requirements Inventory

### Functional Requirements

*From the GDD. MVP = Phases 1–3. Items tagged (post-MVP) are kept for coverage and map to the E6/E7 stubs.*

FR1: Tapping the queen lays eggs: 1 egg per tap plus 1 per Click Power level. Click Power (paid in food, cost rising per level) is the only egg-tap upgrade. From Colony on, DIG takes LAY EGG's place as the main button (FR55).
FR2: Population moves through physical pipelines, egg → larva → worker. Every pipeline exit feeds the next pipeline's count.
FR3: Workers can be assigned to six roles: Gather (food plus wood), Forage (new: nectar), Tend (hatch-rate bonus), Dig (adds to every DIG press and digs slowly on its own, FR55), Guard, Research. Unassigned workers produce at half the gather rate.
FR4: Workers cost food upkeep (baseline workers / 2). Starvation stops growth and shrinks the workforce but never wipes the colony (no hard loss). Batch 2 makes the shrink real (FR61).
FR5: Nest capacity (rooms dug plus Warehouse effect) is a hard cap on workers: larvae wait in the brood when it is full (owner, 2026-11-23).
FR6: Worker efficiency decays above 500 workers (baseline `1 / (1 + 0.0005 × (workers − 500))`). Replaced by crowding in batch 2 (FR60).
FR7: Six buildings (Barracks, Walls, Warehouse, Silk Weaving, Chitin Armory, Venom Lab) can be built and upgraded; cost grows exponentially and effects are soft-capped above Lv.5. The Buildings tree unlocks in Phase 2, combat buildings in Phase 3.
FR8: Combat soldiers cost food plus one worker, train through a pipeline and auto-battle escalating enemies (sub-linear scaling, bounded rounds). A battle ends in victory, defeat or draw.
FR9: Weapons and armor can be upgraded Lv.1–5 in Phase 3.
FR10: Six mutations (Efficient Gatherers, Swift Soldiers, Accelerated Hatching, Tough Shells, Potent Venom, Reinforced Mandibles) are bought with silk, chitin and venom.
FR11: Silk, chitin and venom drop only from battle wins.
FR12: Combat interest bar: at least 3 enemy types, each showing a type and trait before battle, that reward different soldier, equipment or mutation choices; every battle ends with a summary naming its cause; food upkeep and worker cost keep army size a trade-off, so "train the maximum and wait" is not always best.
FR13: Decision events offer 2 choices with visible cost or risk, spawn every 2–3 min of foreground play only while the game is open, never generate or queue offline, and each has an ignore policy (free, costly or unavoidable).
FR14: Each MVP phase (1–3) has at least 3 decision events unique to it.
FR15: Research runs in chains (automation tree from Phase 2, space tree from Phase 4–5); cancelling refunds 50%.
FR16: A verb can be automated once performed manually N times (assumption: 10) or once the next phase is reached; each automated verb has a player-set target and an on/off toggle; offline progress runs the same targets and never decides for the player.
FR17: Phases are strictly sequential and guarded by conditions in `transitions.ts`. The Colony → Expansion alternate route is removed, so Combat is mandatory.
FR18: The phase changes only when the player taps CONTINUE; a met goal stays met (latched) until then, even if numbers dip.
FR19: Depth bar per MVP phase: at least 4 upgrades or buildings competing for that phase's currencies with none strictly dominant, one narrative beat on entry and one near the guard, and a guard-progress readout.
FR20: Offline progress uses one cap: 12 h base, raised to 24 h by Legacy upgrades.
FR21: Offline efficiency chain: base 50%; Phase 2–3 research raises it to 75% (wiped on prestige); a Legacy upgrade raises it to 100% (kept). This replaces Temporal Resonance / Chrono Synchronization, and saves that own them migrate.
FR22: Time away under 60 s counts at full efficiency and opens no summary; 60 s or more is offline time. The rule is the same for a return from the background and a cold load.
FR23: On return after ≥ 60 s the player sees a summary: elapsed time, efficiency, resources gained and lost, and whether the cap was reached. It reports only the absence and suggests no next move (owner, 2026-11-22, PR #439).
FR24: Offline starvation never drops workers below 50% of their pre-absence count. With starvation deaths (FR61) at most 20% of the eaters can be lost while away (80% kept).
FR25: Pause is in-session only: hiding or closing the app ends it, the time away is normal offline time, and a pause is never saved.
FR26: No notifications in the web build; nothing in the game may depend on notifications.
FR27: Every check-in offers at least one decision worth making (an allocation change or an affordable upgrade) without relying on decision events. The game state carries this; the return summary does not name the decision (changed 2026-11-22, PR #439).
FR28: Prestige unlocks when Barracks, Walls and Warehouse reach Lv.5 and lifetime production passes the food, wood, stone and nectar thresholds.
FR29: Legacy Points = `floor(log10(totalFoodProduced) × phaseScore / 10)` + entropy bonus. The production bonus (+15% per LP) is based on LP earned across all runs, so spending LP never lowers it.
FR30: Prestige wipes everything except LP, purchased Legacy upgrades (including the offline upgrades), lifetime statistics and the victory record; existing saves that carry space resources across prestige migrate.
FR31: The victory record is a permanent record and achievement only; it skips, unlocks or shortcuts nothing.
FR32: Phase Skip never skips a phase the player has never completed.
FR33: Win = reach Transcendence and complete its ending; there is no hard loss; from every reachable state the player can progress without prestige (soft-lock prohibition).
FR34: Every resource and cost is an integer (fix `darkMatterDetection: { antimatter: 0.1 }`); entropy is a 0–100 meter, not a resource; non-integer intermediates are internal only.
FR35: Numbers show in full up to 999,999, then short-scale suffixes; no scientific notation before Transcendence (refined per surface by UX-DR3).
FR36: Wood, stone and nectar are producible from worker roles in Phase 2, so the Buildings tree is buyable in the MVP.
FR37: Every resource is producible before the feature that consumes it unlocks (catch-22 rule).
FR38: Local, privacy-respecting play telemetry records time per phase, check-in length and decisions per check-in; no network.
FR39: An automated check proves every phase guard is reachable from that phase's own production, with no prestige.
FR40: Phases 1–3 are tuned to the Difficulty Curve targets (Phase 1 in 3–5 min active, Phase 2 in 20–40 min active within day 1, Phase 3 over days 2–3); the hatch, mature and train times have an unambiguous unit. Superseded by the first-week targets (FR54, FR65), tuned in Epic 9.
FR41: Each tap gives immediate visual feedback, plus haptics where available.
FR42: MVP sound effects for tap, hatch, battle result, phase transition and decision event; muted by default on mobile; respect the device's silent mode.
FR43: Each phase applies its own palette on entry (Phase 1–3 palettes are MVP); an icon exists for every resource and building (Phase 1–3 icons are MVP).
FR44: The colony is shown as countable ants (a nest cross-section that fills up).
FR45: Mobile controls: bottom tab bar with at most 5 destinations (never a sixth); one primary action per screen in the thumb zone; tap-and-hold repeats buy and assign (~8/s); steppers with ×1, ×10, ×max.
FR46: Decision events appear as a bottom sheet whose timer pauses while the app is backgrounded.
FR47: Desktop layout shows the same screens in 2–3 columns; keyboard shortcuts for the primary action and tab switching.
FR48 (post-MVP): Territory: an 8×8 fog-of-war map; scout, claim and send expeditions (max 3 active); scouts and warriors capped by Barracks level; claimed tiles yield by terrain.
FR49 (post-MVP): Spaceships (scout, cruiser, capital) explore 4 planets for space resources (max 3 active); scout ships bootstrap through 10% expedition space drops.
FR50 (post-MVP): Entropy (0–100) is raised by dark matter, erodes production, can be dampened and feeds the prestige bonus; tuned so dark matter stays a real trade-off.
FR51 (post-MVP): Reaching Transcendence plays the ending sequence (≤ 5 min), records the victory and offers prestige.
FR52 (post-MVP): The Legacy tree is balanced so a second run reaches the first run's furthest phase in at most 50% of the time.
FR53 (post-MVP): Phases 4–5 meet the depth bar and the Days 4–7 / Weeks 2–3 targets; the per-tick territory and entropy rates get an unambiguous unit.
FR54: Session shape (owner, 2026-11-22): session 1 runs 45–60 min with no wait wall before ~30 min; days 1–3 sessions of 5–15 min; check-ins taper to 90–120 s after about a week. Phases 1–3 fill the first week (Colony ends later on day 1, Combat lasts to ~day 7); first victory in about 4 weeks.
FR55: DIG is the main button from Colony on: one press digs one fixed chunk of the next room; each room takes more presses than the last; every chunk comes out as stone; a room holds several ants; diggers add to every press and dig slowly on their own, so a player who never taps still gets rooms.
FR56: Digging progress is visible: a crack grows at the dig face in the scene, and a NEXT ROOM strip shows a bar, the time left and the presses left.
FR57: FEED is a free tap on the brood in the scene that speeds larvae toward becoming workers, only while a room is free.
FR58: Auto-dig is bought with stone once the player has dug a few rooms by hand; from then on the diggers press DIG on their own and DIG becomes an optional boost.
FR59: The nest scene draws only the rooms dug so far, so a young nest fits a phone without zooming; each new room grows the picture with a quick opening animation (replaces the 2× camera crop).
FR60 (batch 2): Crowding replaces worker efficiency: work slows with creatures per unit of room space; workers, soldiers, eggs and larvae count (not the queen); no slowdown while the creatures fit the room space, then work falls with the overfill, never below 50% (owner, 2026-11-23); shown in the scene and the NEXT ROOM strip; a formula of the current state.
FR61 (batch 2): Starvation warns first, then kills only eaters (workers and soldiers, at random), just enough to bring food use back to production, spread over time (one death every 2–10 s, set by tuning; owner, 2026-11-23); queen, eggs and larvae never starve; at most 20% lost while away. The warning and the offline cap ship with the deaths. A formula of the current state.
FR62 (batch 2): Food has a storage limit; every dug room stores some and Larder rooms much more (owner, 2026-11-23); food past it is lost; the offline summary says when food stopped at the limit.
FR63 (batch 2): When a room opens (Colony on) the player may give it one of three jobs (Pantry, Larder, Gallery) or leave it plain; a job can be changed later for stone (owner, 2026-11-23); effects are colony-wide, counted by rooms.
FR64: The swarm reaches thousands: phase goals are rescaled to the GDD's target ranges (Phase 1–2 with batch 1, Phase 3+ with batch 2); exact guards live in `transitions.ts`.
FR65: `pnpm sim` reports three first-week gates as pass/fail (never asserted in CI): no idle gap over 2 min before 30 min of continuous play; Phase 3 lasts to about day 7; after day 7 the median check-in is 90–120 s and every check-in offers at least one decision.
FR66: The player can read at a glance whether the colony is okay and where its food comes from and goes: a verdict line with a runway, who brings food in, who eats it and what one-off spends took it (from the #437 brainstorm).

### NonFunctional Requirements

NFR1: The interface gives a visual response to a tap within 100 ms, before the state write lands.
NFR2: Scrolling and transitions hold 60 FPS on the reference device (a mid-range ~2022 Android phone).
NFR3: Game outcomes are independent of frame rate and device speed.
NFR4: Offline catch-up for 12 h (24 h with upgrades) completes in under 500 ms on the reference phone (measured and reported; CI asserts a deterministic step budget, never wall-clock time).
NFR5: No processing while the app is hidden; progress is computed on return (no battery cost while closed).
NFR6: Fast first load is a quality goal with no hard target: terminal text renders first, the vector scene fades in, later launches load from cache. The download is kept small (no hard size limit).
NFR7: Portrait first, safe-area aware, minimum viewport 360×512 CSS px with a reflow floor of 320 px and 200% zoom; desktop layout from 1024 px.
NFR8: Saves are local, versioned and migrated; saves from every shipped version migrate and load or are retired explicitly; a rotating backup is kept; a save is never silently reset or overwritten by a bad state.
NFR9: Hit targets are at least 44×44 px with 8 px spacing; no information is hover-only; every tooltip has a tap equivalent.
NFR10: No network is needed to play; no accounts, cloud saves, leaderboards or multiplayer; telemetry and diagnostics stay on the device.
NFR11: No art budget: all art is vector/procedural (TSX SVG glyphs and scenes, synthesized audio); no emoji and no binary game assets.
NFR12: Zero soft-locks, enforced by a CI test.
NFR13: Every feature works within a 90–120 s phone check-in (the steady state after the first week) and keeps progressing offline ("respect the check-in").
NFR14: Banned: ads, gacha, energy timers, timed "claim" buttons, streaks, numeric badges, interstitials, and any mechanic that requires repeated tapping (DIG and FEED are first-week boosts: progress never depends on them).
NFR15: Accessibility floor: reduced motion, live regions, full keyboard operation, visible focus, hue never the only signal, measured contrast (DESIGN.md table).

### Additional Requirements

*From the architecture and ADRs 0001–0005. Brownfield: **no starter template**. Story 1 of the foundation epic is the Preact adoption, not a scaffold.*

- AR1 (Preact adoption, ADR 0004): add `preact` and `@preact/signals`; JSX in `tsconfig.json` (`"jsx": "react-jsx"`, `"jsxImportSource": "preact"`) with Vite's built-in transform (`@preact/preset-vite` only if its peer range covers Vite 8); a check that exactly one `@preact/signals-core` version is installed; one Preact root per tab container; panels migrate one at a time keeping their `data-*` / `id` selectors.
- AR2 (Time model, D1/ADR 0002): `Ticker` runs a 50 ms fixed step on rAF only while visible; on `visibilitychange`→hidden or `pagehide` force a save with `lastSeenAt` and stop; `beforeunload` is a fallback; `resume(elapsedMs)` is the only entry for cold start and return (≤ 0 → 0; < 60 s full efficiency, no summary; ≥ 60 s catch-up then summary); a visible frame gap > 1 s goes to `resume(gap)`; wall clock only for gaps, game time for everything simulated, a session clock for decision spawning.
- AR3 (One cap): `getOfflineCapMs(state)` replaces the 4 h cap (`OfflineProgression.ts`), the 8 h cap (`GameLoop.ts`) and the 1 s frame cap (`Ticker.ts`).
- AR4 (Catch-up, D2): macro-steps through the same `processTick` (initial `dt` 10 s); every system correct for any step length; offline-only rules inside catch-up (efficiency, starvation floor, no decision events, no phase commits; the latch may set); a property test compares macro-step with fine-step results; CI asserts a 24 h catch-up uses at most a fixed number of `processTick` calls (from `data/constants.ts`); `pnpm perf` reports timing on the reference phone.
- AR5 (Phase flow, D3/ADR 0003): `Transition.conditions: { id, label, current(s), target(s) }[]`, guard derived as all-met; `PhaseStateMachine` splits into pure `evaluate()` and `commit()` (only from CONTINUE); `state.phaseGoal = { phase, latched }` survives dips and saves, cleared by commit and prestige; order: remove `COLONY_TO_EXPANSION` → add conditions → split FSM → migrate E2E seeds to tap `[data-action="continue"]` (~7 E2E specs, 4 unit files assume auto-transition).
- AR6 (Persistence, D4): a `SaveStore` interface over localStorage (current key, 2-slot rotating backup); `load() → { status: 'ok' | 'recoveredFromBackup' | 'unreadable' | 'empty', state? }`; `navigator.storage.persist()` after first meaningful play; a one-time add-to-home-screen hint; export/import. Inside the save: state, `phaseGoal`, the open decision event with remaining time, the event log (last 100 lines), `lifetime.revealsSeen`, `lifetime.phasesCompleted`, PRNG state. Outside the save (own keys, survive prestige and import, not exported): settings, intro flag.
- AR7 (Migrations): one numbered step per schema change, two branches claiming one version merge into one function, never renumber; a fixture per shipped version under `tests/saves/` (v5–v7 there today, plus v1–v11 snapshots in `tests/snapshots/`) and a test that every fixture migrates to current and loads. Current save version: 13.
- AR8 (State, D5/ADR 0001): one `signal<GameState>`, one spread write per tick, user actions write between ticks; `src/state/selectors.ts` exports `computed` slices; components and effects read selectors only; delete `StateManager`, `Store`, `GameStatePool` (#186).
- AR9 (Randomness, D6/ADR 0005): a seeded 32-bit PRNG with its state in `GameState`; systems take and return it; no `Math.random` in `src/systems` or `src/sim` (11 files under `src/` use it today); UI-only randomness may.
- AR10 (UI shell, D7): a tab registry as data (`{ panelId → tab, segment?, unlockPhase }`) replacing `PHASE_PANELS` in `PhaseContent.ts`, with a test that no phase shows a sixth tab; one `SheetController` signal with a queue and priority (offline summary > decision event > battle summary > other modal > peek); modal sheets never stack, opening a modal closes any peek; an overlay layer (phase reveal, title cinematic, ending) blocks input and holds decision events.
- AR11 (Decision events, D8/N3): events are data `{ id, phases, ignorePolicy, timerMs?, ignoreLine, choices[], ignore? }` in `data/content/decisions.ts`; spawn on the session clock (≥ 2 min foreground since launch), never during an overlay or before the offline summary is dismissed, at most one open; countdown on game time; `state.decision = { open: { id, remainingMs, openedAtSessionMs } | null, nextSpawnSessionMs }` saved; reopens on resume after the summary; one pure `applyChoice(state, event, choice | 'ignore')`; catch-up skips `DecisionSystem.tick`; the countdown never runs while waiting behind another sheet.
- AR12 (Platform services, D9): `src/platform/` interfaces `Audio`, `Haptics`, `Notifications`, `Storage`, `Lifecycle`, with web implementations; `capabilities.ts` detected once at boot (features degrade, never crash); `settings.ts` one signal, own key, own version; `Notifications` has no web implementation and its toggle is hidden on web; haptics via `navigator.vibrate` or no-op, never the only feedback; platform passed in at boot (`createGame({ storage, audio, haptics, lifecycle })`).
- AR13 (PWA, D10): vite-plugin-pwa ≥ 1.3 generates manifest and service worker; precache everything; a new version activates on the next cold start and never reloads mid-session; manifest `display: "standalone"`, portrait.
- AR14 (Scene rendering, D11/N1): nest, map and star map as Preact SVG components with HTML label overlays; ≤ 50 individually animated ants, the rest one dot-cloud `<path>` per chamber; `selectNestView` (≤ 4 Hz) → pure `nestLayout` → dumb SVG; one `useSceneClock` rAF loop, stopped when hidden or under reduced motion; camera steps and cloud threshold in `data/balance/scene.ts`; no per-ant state in `GameState`; fallback to Canvas 2D if measured p95 frame time > 16 ms (`pnpm perf`, not CI).
- AR15 (Pacing harness, D12/N2): headless DOM-free `src/sim/` (`SimRunner`, `CheckInSchedule`, `PlayerPolicy`, `Probes`) using only `resume()` and `actions/`, no sim-only shortcuts; `checkReachability(phase)` gates CI with a generous ceiling (e.g. 10× target), not the target; `runPacingReport()` via `pnpm sim` (not CI); a local telemetry ring buffer exportable from settings.
- AR16 (Errors): expected outcomes return `Result` (`{ ok: false, reason }`), never throw; `GameLoop` catches per tick, discards that tick's write and logs; after 3 consecutive failed ticks the simulation pauses with an EXPORT SAVE / RELOAD sheet; errors never overwrite a good save; `EventBus` isolates listener errors and always logs them (today it silently drops them in browser builds).
- AR17 (Logging): `src/utils/log.ts` is the only `console.*` caller (11 direct calls migrate), enforced with oxlint `no-console` (lint is not in CI yet, #191); levels error/warn always, info in dev and `?debug=1`, debug dev-only; a 200-entry ring buffer; nothing logged per tick; catch-up logs one summary line.
- AR18 (Events): one typed `SwarmEvents` interface in `src/engine/events.ts` (no string index signature; ~45 names today); `snake_case` past-tense names, migrating `state:changed` and `click:egg`; events raised in a tick are queued and flushed after that tick's write; catch-up and `src/sim/` use a collecting bus; no listener writes state.
- AR19 (Config): `src/data/constants.ts`; balance in `src/data/balance/*.ts` (`as const`, one file per system); content tables in `src/data/content/*.ts` (decision events, enemy types, critical-path tables, tab registry, planets, prestige tree); tests import balance values, never re-type them; no remote config.
- AR20 (Units and integers): durations in ms with `Ms` suffix, rates `PerSec`; no ticks in balance data (resolves the tick-unit ambiguity); resources integer at rest, fractions only in pipeline `progress` / `*Remainder`; `formatInt` floors; a property test that every `state.resources` value is an integer ≥ 0 after random ticks and catch-ups.
- AR21 (Boundaries): `tests/arch/architecture.test.ts` enforces 6 import rules: game layers import no DOM/`ui`/`platform`/`debug`; `ui/` reads only selectors and writes only via `actions/`; only `engine/GameLoop` writes during a tick; `platform/` imports only types; nothing imports `debug/` except `main.tsx`; guard thresholds only in `transitions.ts`, balance only in `data/balance/`; also no `Math.random` in `systems/`/`sim/` and no `gameState.value` under `ui/`.
- AR22 (Communication): systems are modules of pure functions taking a `TickContext` (`{ rng, events, balance, dtSec }`); player intents live in `src/actions/` and return `Result`.
- AR23 (Entities and state): plain JSON-serializable data from pure factories; sequential integer IDs (`state.nextId`) or snake_case content IDs, no random IDs; discriminated unions for lifecycles (expeditions, explorations, research, battles) with game-time ms; only `commit` or prestige assigns `state.phase`; nested spreads at every changed level.
- AR24 (Debug tools): overlay (FPS, tick p50/p95, catch-up time, seed, save version), state inspector, log viewer, export diagnostics (also in Settings); toggled by backtick or 3-finger long-press in dev and `?debug=1`; cheats (`window.__swarm`: add resources, set phase, time-skip, set seed) dev-only and tree-shaken.
- AR25 (Dependency hygiene): add `pnpm audit --prod --audit-level=high` as a step inside an existing CI job (no new job key); weekly grouped Dependabot PRs for dev dependencies; runtime dependencies limited to `preact`, `@preact/signals`, `@preact/signals-core` and the PWA runtime (more needs an ADR).
- AR26 (Structure): target layout from the architecture (`engine, state, actions, systems, phases, persistence, platform, sim, data/{balance,content}, utils, debug, ui/{shell,tabs,sheets,overlays,scenes,primitives,glyphs,styles}`); `UIRoot.ts` and `ui/panels/*` are removed as each panel migrates; tests under `tests/{unit,arch,sim,perf,e2e,saves}`; unit tests build state with `makeState(overrides)`; E2E seeds with `seedSave(page, state, { introSeen: true })` before `page.goto('/')`.
- AR27 (already done, no story): `package-lock.json` is gone and Context7 is configured (`.mcp.json` plus the CLAUDE.md line). The handoff still lists the lock file as present.

### UX Design Requirements

*From DESIGN.md and EXPERIENCE.md. Visual specs and tokens in DESIGN.md are normative; mockups are illustrative.*

UX-DR1: Design tokens in `ui/styles/tokens.css`: 6 phase palettes × 7 values (`bg, raised, line, edge, dim, accent, warn`) plus `scrim`; runtime aliases (`--color-accent` …, `on-accent` = phase `bg`) rebound on phase entry; components reference aliases only; a unit test recomputes the DESIGN.md contrast table from the tokens.
UX-DR2: Typography: one shipped OFL monospace subset ("Swarm Mono", WOFF2 regular + bold, covering ASCII, box-drawing, blocks and `· − × ✓ ✗ ▲ ▼ • █ ░ ▒ ▓`) with system monospace fallback; 6 roles (display 24, title 20, value 15, body 14, aside 13, meta 12) authored in rem; nothing below 12 px; no sentence case below 13 px; text glow only ≥ 15 px; zoom never disabled.
UX-DR3: Number formatting: strip shows full digits to 9 999, then 5-character suffixes (`12.4K`, `1.24M`); elsewhere full digits with space grouping to 999 999, then suffixes; tabular figures; floor, never round up; no scientific notation before Transcendence.
UX-DR4: Character grid: `cols = floor(contentWidth / advanceWidth(body))`, target 36; at 28–35 meters shrink to `cols − 8` and two-column rows stack; below 28 box-drawing becomes 1 px CSS borders, text wraps, meters become `74 % ████····`, tables become label-over-value stacks; never clip text.
UX-DR5: Portrait skeleton: resource strip (min 56 px), phase line, goal meter, nest scene `clamp(120px, remaining, 220px)`, event lines (3, or 1 below 560 px height), pinned primary zone (64 px), tab bar (52 px); safe-area insets; primary action, tab bar and sheet actions in the bottom 40% of `100dvh`; scroll areas padded by primary zone + tab bar; `scroll-padding-bottom` so focused items are never hidden; margins 14 px, 8 px below 360 px.
UX-DR6: Responsive: 600–1023 px single column centred at 600 px; landscape never blocked, primary zone un-pins below 480 px height; desktop ≥ 1024 px: 160 px left text rail replaces the tab bar, NEST in column 1, the active tab in columns 2–3 (BUILD on first visit), each column with its own primary zone, sheets become centred dialogs (max 480 px), content max 1280 px.
UX-DR7: Resource strip: five equal cells with glyph, ≤ 4-letter label, value (≤ 5 chars) and delta (no `/s`, negatives `warn` with `−`); per-phase sets (P1 EGG LRVA WRKR FOOD; P2 FOOD WRKR WOOD STON NECT; P3+ capped or falling first); capped value `warn` with ▲; refresh ≤ 4×/s; above ~125% text scale 3 cells plus `+2 ▸`; tap opens the resource sheet; hosts the persistent `• SAVE FAILED` marker.
UX-DR8: Resource sheet: every unlocked resource with a 30 px glyph, full name, exact integer, rate (unit stated once), cap and source; `[ SETTINGS ⚙ ]` at the bottom (so settings are reachable in Phase 1). **Changed 2026-11-23 (#437):** two lines per resource (glyph, name, amount; then rate, source and a text sparkline in `dim`); a cap only where one exists, as a fill meter (no `—`); falling or capped resources first; rates under 1/s read per minute; groups by tier past about 8 rows; a new resource marked `NEW` once; a tap on a row opens its sources and spends (Stories 9.10–9.12).
UX-DR9: Tab bar: tabs revealed by phase (Phase 1 none; Colony reveals NEST · WRKR · BUILD · LOG at once; Combat adds FRONT); active tab inverse video; `•` when something on that tab became affordable since the last visit, cleared on visit; tapping the active tab scrolls to top; 4-letter names above 130% text; no numeric badges; each tab keeps scroll position and segment for the session; nothing deeper than tab → segment → sheet.
UX-DR10: FRONT segment row `WAR · MAP · STARS` that grows by phase, opens on the newest segment, remembers the last used, 44 px targets.
UX-DR11: Primary action: 1.5 px accent border, `> ` prefix, block cursor blinking 1 Hz for ≤ 5 s after input (steady under reduced motion or CRT OFF); pressed = inverse video held until release (not re-inverted per repeat); truncates the target name, never the verb; cost line moves inside as a second line when the label would wrap or height < 560 px; fires on pointer-up (drag-off cancels); hold repeats ~8/s, accelerating after 1 s.
UX-DR12: Next-action rule as a pure `getNextAction(state)` shared by NEST (after Phase 1), WRKR and the offline summary: 1 goal met → CONTINUE (Phase 6 TRANSCEND); 2 food critical → allocation fix; 3 capacity ≥ 95% → DIG or Warehouse; 4 affordable item from the phase's critical-path table (data); 5 any affordable item; 6 none → `NEXT AFFORDABLE: <item> IN ~<time>`; target locked during a hold and for 1 s after the last tap. **Changed 2026-11-23:** from Colony on NEST's primary action is DIG (CONTINUE when the goal is met), and the offline summary has no next-action button (PR #439); the rule stays for WRKR, the tab dots and the simulated player.
UX-DR13: Goal meter: `NEXT: <conditions>` read from `transitions.ts` conditions, one row per condition with `met`/`need` and ✓/✗, never naming the next phase; latched state `GOAL MET` with dipped rows reading `<now> now, reached <value> at <time>`; a condensed one-line meter (`NEXT ████······ 74%`) on other tabs.
UX-DR14: Phase change: never automatic; when the goal is met NEST gets `•` and its primary action becomes `> CONTINUE`; nothing about the next phase shows before the tap.
UX-DR15: Stepper and role row (WRKR): `[−] value [+]` 44 px brackets with a `×1 ×10 ×MAX` multiplier row; every step applies immediately; values stay within 0 and available (×MAX respects capacity; Research counts toward the assigned total); hold repeats; role rows show name, text bar, count; `[+]` disabled with `no free workers`; the upkeep readout `UPKEEP n / PRODUCTION n` with net (negative `warn` ▼) updates live.
UX-DR16: Automation target row: `KEEP [−] N [+] IN TRAINING` plus `[AUTO]` toggle (inverse when on), appears under the verb once automatable, shows `holding at N` or a `warn` reason (`food short`).
UX-DR17: Card (building, research, mutation, enemy, Click Power): only the action is tappable; title line with glyph and level change, effect line, cost line with inline glyphs and shortfall in `warn` (`needs 60 more △`); first time affordable it highlights for 2 s; BUILD header `NEXT: <item> IN ~<time>` when nothing is affordable.
UX-DR18: Click Power card: on NEST under the event lines in Phase 1 once first affordable (buying it doesn't change the primary action); in BUILD from Phase 2.
UX-DR19: Research card: `> START` runs one chain step with progress meter and time remaining; while running `CANCEL (50 % BACK)` needs hold-to-confirm and shows the refund before confirming.
UX-DR20: Button states: secondary action (dim, no border, ≥ 44 px); disabled (dim label, 1 px dashed `edge` border, reason on the cost line, no opacity fade); focus indicator (2 px accent outline, 2 px offset, no reliance on glow).
UX-DR21: Hold-to-confirm primitive for prestige, research cancel and save import: a square ring of block cells fills over the hold (1 s default, adjustable); releasing early drains it; two-tap mode arms for 5 s with `> TAP AGAIN TO …` in inverse; holding Enter or Space works on keyboard.
UX-DR22: Sheets: modal bottom sheet (raised, accent top rule, handle, display headline, body, ≤ 2 actions, scrim; closes by swipe down, scrim tap, `[ CLOSE ]` or Esc except decision sheets); peek sheet (≤ 160 px, no scrim, header names the target, ≤ 2 actions); sheets never stack; `role="dialog"`, `aria-modal`, focus to headline, trapped, returned to trigger on close.
UX-DR23: Decision sheet: situation, 2 choices with visible cost/risk, timer meter under the headline when timed, `IGNORE: <outcome>` line; free (`IGNORE: NOTHING HAPPENS`), costly (outcome on timeout, logged, toast once) and unavoidable (no timer, no dismiss) policies; a one-time `TIMERS CAN BE SLOWED IN SETTINGS` hint on the first timed event; not closable with Esc; held while an overlay is up.
UX-DR24: Offline summary sheet: `YOU WERE GONE 6H 12M. THE NEST KEPT WORKING.` voice; elapsed time, efficiency %, gains and losses with glyphs, a cap line reading the live cap (`THE NEST STOPPED GROWING AFTER <cap>.`), warn lines (e.g. upkeep outran food); no next-action button (removed 2026-11-22, PR #439); never empty; focused on open.
UX-DR25: Battle summary sheet: VICTORY / DEFEAT / DRAW headline, losses, drops, one cause line (`THEIR SHELLS TURNED YOUR VENOM.`), `> CHANGE → <card>` opening the relevant mutation or equipment card.
UX-DR26: Enemy card: type and trait shown before committing; `> FIGHT` as primary action, disabled with `train soldiers first` when there are no soldiers; round counter while a battle runs.
UX-DR27: Phase reveal overlay: full screen, input-blocking, 3 s palette cross-fade, phase name in display, one event line typing in, ≤ 3.5 s; skippable (tap, Enter, Esc) only after that reveal has been seen once (`lifetime.revealsSeen`); the Combat reveal draws the first enemy; decision events wait until it ends.
UX-DR28: Title cinematic (first launch: no save and no intro flag): ~11 s, Phase 1 amber visuals only, skippable by tap/Enter/Space/Esc, ends on a real `[ TAP TO WAKE THE QUEEN ]` button, then `A QUEEN, ALONE.`, the brood chamber and a coach mark on LAY EGG; the flag (own key) is set when it starts; replay intro in settings; E2E sets the flag.
UX-DR29: Toast (one line, 2 s, replaces earlier toasts, never the only place for something actionable) and coach mark (one element, one line, once per concept, dismissed by the action or `[ GOT IT ]` with the tap consumed, announced politely).
UX-DR30: Event lines: newest first, newest prefixed `> ` in accent, older `· ` in dim; persisted with the save (last 100); tapping a line that points at something jumps to it; NEST shows the newest 3 (1 below 560 px).
UX-DR31: LOG tab: full persisted event log (never empty after Phase 1), lifetime stats, settings including PAUSE, and a LEGACY section once the prestige unlock condition is met (prestige and Legacy tree).
UX-DR32: Settings (reached from the resource sheet and LOG; stored outside the save): sound (off by default, respects silent mode), haptics, reduced motion (follows the OS), CRT effects SCENE/FULL/OFF, decision timers normal/×2/off, confirm style hold/two-tap plus hold duration, lay mode hold/toggle, keyboard shortcuts on/off and remappable, replay intro, PAUSE, export/import save, export diagnostics; no notifications toggle on web; text size follows the browser.
UX-DR33: App states: corrupt save or failed migration → `THIS SAVE COULDN'T BE READ.` with LOAD BACKUP / START OVER; save write failed → `• SAVE FAILED` strip marker that explains and offers EXPORT SAVE; import invalid → `THAT FILE ISN'T A SWARM SAVE.`, valid → hold-to-confirm sheet stating it replaces the run; paused → `PAUSED` overlay line, next tap resumes, never reopens paused; cold load renders terminal text before the scene.
UX-DR34: Nest scene: vector soil (accent 7% fill, grain, strata, pebbles, grass line), round-capped tunnels, ellipse chambers, solid-accent queen, workers, eggs and larvae; the scene draws only the rooms dug so far, so a young nest fits without zooming (replaces the 2×/1.5×/1× camera steps, Story 9.6); an individually drawn worker never under 12 px; beyond ~15% chamber coverage extras become a dot cloud with 30–50 ants on top; exact counts as HTML chamber labels; each chamber a labelled focusable button opening a chamber peek sheet (from Colony on the brood's button feeds instead, Story 9.4); a starving colony visibly thins; ants wander gently between check-ins; root labelled "Nest: 37 workers, 5 eggs, 4 larvae".
UX-DR35: Glyphs: 20 TSX SVG line glyphs (14 resources, 6 buildings) plus a gear, 24×24 grid, 1.6 px round-capped stroke, `currentColor`, used only inside text (15 px strip, 13–14 px cost lines, 18–22 px cards, 30 px resource sheet); VNOM redrawn as fang or vial; no emoji anywhere, placeholders included.
UX-DR36: CRT effects: SCENE (default) puts scanlines only on the vector scene and overlays, glow (3 px drop-shadow) on line-work, text-shadow ≤ 2 px at ≤ 35% on accent text ≥ 15 px; FULL adds scanlines everywhere and states the contrast caveat; OFF removes both; OFF auto-selected for more-contrast / reduced-transparency or text scale > 130%; scanlines in device pixels.
UX-DR37: Game feel per trigger (lay egg, hatch/mature, newly affordable, press/hold buy, battle result, decision event, phase change, camera pull-back, ending): visual, haptic and sound as in the EXPERIENCE table; sounds rate-limited (hatch ≤ 1/s, key click ≤ 8/s).
UX-DR38: Flash rule: no element changes luminance more than 3 times in any 1 s; an E1 test asserts this during a 2 s hold.
UX-DR39: Reduced motion (OS or in-game): no typing effects, wandering, camera easing or floating `+N`; 300 ms palette fade instead of 3 s; cinematic opens on its logo; ending is a 1 s fade; steady cursor; CRT OFF; the cursor stops blinking after 5 s idle in any mode.
UX-DR40: Accessibility semantics: typed decoration (`>`, `·`, `█`, brackets, box-drawing, text meters) `aria-hidden`; meters `role="progressbar"` with `aria-valuetext`; goal conditions as a list reading met/not met; full accessible names ("Add one gatherer", "Stone"); real list/table markup; typing effects visual only; polite live regions for goal met, phase entered, battle result, decision arrived, costly ignore applied, starving, capacity reached, save failed, offline summary; no per-tick announcements; focus order strip → goal → nest summary → event lines → primary action → tab bar (desktop: rail → col 1 → cols 2–3).
UX-DR41: Keyboard: Space triggers the active tab's primary action only when focus is on the page or that button (a focused stepper takes Space itself); 1–5 switch tabs; P pauses (today's Space-to-pause moves to P); Esc closes non-decision sheets; shortcuts can be switched off and remapped; hover shows only what a tap would, stays dismissible and hoverable (WCAG 1.4.13).
UX-DR42: Voice and tone: colony lines short, present tense, upper case; interface plain; no exclamation marks anywhere (rename `Overcrowding!` → `OVERCROWDING.`); title `ONE EGG. ONE QUEEN. ONE SWARM.`; nothing names a later phase early; abbreviations visual only.
UX-DR43: Resume from background: after ≥ 60 s the offline summary opens exactly as after a cold load; after < 60 s no sheet opens and strip deltas flash once.
UX-DR44 (post-MVP): Map tile select-only: a tap selects (inverse video) and opens a peek sheet with terrain, yield, risk and SCOUT / CLAIM / EXPEDITION; a tap never commits; tapping another tile retargets; auto-scroll keeps the tile 16 px above the sheet; FRONT primary hidden while the peek is open; below 352 px tiles stay 40 px and the map pans with a `[◂ ▸ ▴ ▾]` control; unknown tiles `?` with `SEND SCOUTS TO SEE.`
UX-DR45 (post-MVP): Expedition force steppers capped by Barracks level, expedition result sheet (success/partial/failure, losses, loot, tiles revealed), `3 of 3 out · back in 14m` disabled state, star map with planet peek sheets, entropy meter `warn` above 75%.
UX-DR46 (post-MVP): Phase 6 NEST final goal meter with `> TRANSCEND`; Transcendence ending overlay (colony breaks into characters, scatters, `THE SWARM IS EVERYWHERE NOW.`), then LOG → LEGACY opens with prestige offered; after prestige `A QUEEN, AGAIN.` with no cinematic.
UX-DR47: NEXT ROOM strip under the nest scene: `NEXT ROOM` (or `NEXT ROOM · AUTO-DIG ON`), the next room's size `+N`, a text meter, `IN <time>` and `· <n> DIGS`; a matching crack at the scene's dig face; batch 2 adds `CROWDED · −<n>% WORK`.
UX-DR48: NEST from Colony: the goal block condensed to at most 4 lines; scene; NEXT ROOM strip; brood control on one line (`BROOD <n> EGGS · <n> LARVAE  KEEP [−] N [+] AUTO`); event lines; `> DIG` in the pinned primary zone with a hint line (`chunk +n · n stone · tap the brood to feed when a room is free`); FEED is a tap on the brood in the scene (a labelled button), greyed `FEED · NEST FULL` with no free room. Mockups: https://claude.ai/artifact/Rs3RWvuwqrsbx7p5CWEsNp (their two-button row is superseded: DIG alone, FEED in the scene).
UX-DR49: Dig feel: each press a crunch, a small shake (none under reduced motion) and a dirt puff; breakthrough a short opening animation, a sound and a vibration where `navigator.vibrate` works (iPhone Safari: sound and shake only); within the flash rule (UX-DR38) and the sound rate limits.
UX-DR50: Resource sheet verdict line: the first line names the worst state (`FOOD LASTS 14M`, `NEST FULL · 3 LARVAE WAIT`, `EVERYTHING IS GROWING`) with a runway (`LASTS <t>` when falling, `FULL IN <t>` when a limit exists); tapping it opens the screen that fixes it (never on its own); a `SINCE <time>` line shows what changed since the sheet was last opened.
UX-DR51: Resource sheet food block (from Colony): `FOOD IN +n/S ← gatherers n · idle n`, `EATEN −n/S → workers n · soldiers n`, `SPENT THIS HOUR: <item> n · …`, `ONE GATHERER FEEDS <n>.`; each name opens its role row or WAR; controls that add an eater show its food cost (`+0.75/S EATEN`).

### FR Coverage Map

Built systems that already work (FR1, FR2, FR4–FR11, FR15) get stories only where the plan changes them.

FR1: Epic 1 - Lay egg on NEST, hold-to-repeat, Click Power card
FR2: Epic 3 - Pipelines stay correct for any step length (macro-step catch-up relies on it)
FR3: Epic 3 - Forage role; Gather/Dig yield wood and stone
FR4: Epic 3 - Upkeep and starvation keep their soft-setback rule under the new units
FR5: Epic 3 - Nest capacity (existing; covered by the unit and integer passes)
FR6: Epic 3 - Scale penalty (existing; balance moves to data files)
FR7: Epic 3 - Buildings buyable from Phase 2, combat buildings in Phase 3
FR8: Epic 4 - Combat soldiers, auto-battle, draw outcome
FR9: Epic 4 - Equipment competes with mutations as counterplay
FR10: Epic 4 - Mutations as counterplay to enemy traits
FR11: Epic 4 - Combat drops only from wins (kept; asserted)
FR12: Epic 4 - Enemy types, traits, battle cause, army trade-off
FR13: Epic 1 (lifecycle) + Epic 4 (content and policies) - Decision events
FR14: Epic 4 - 3 unique decision events per MVP phase
FR15: Epic 1 (research card and cancel confirm) - Research chains with 50% refund
FR16: Epic 4 - Automation unlock rule and player-set targets
FR17: Epic 1 - Colony → Expansion route removed; Combat mandatory
FR18: Epic 1 - CONTINUE with latched goal
FR19: Epic 4 - Depth bar: 4 competing upgrades, 2 narrative beats, guard readout
FR20: Epic 2 - One offline cap, 12 h → 24 h
FR21: Epic 2 - Offline efficiency chain; Temporal Resonance / Chrono Synchronization migrated
FR22: Epic 2 - 60 s full-efficiency window
FR23: Epic 2 - Offline summary sheet
FR24: Epic 2 - Offline starvation floor
FR25: Epic 2 - In-session pause
FR26: Epic 2 - No web notifications (interface only)
FR27: Epic 2 - Every check-in offers a decision (summary never empty)
FR28: Epic 5 - Prestige unlock condition
FR29: Epic 5 - LP formula; bonus on lifetime LP
FR30: Epic 5 - Prestige wipe and its save migration
FR31: Epic 5 - Victory record is a record only
FR32: Epic 5 - Phase Skip never skips an uncompleted phase
FR33: Epic 3 (soft-lock prohibition) + Epic 7 (win and ending)
FR34: Epic 3 - Integer resources and costs
FR35: Epic 1 - Number display rules
FR36: Epic 3 - Phase 2 basic-resource sources
FR37: Epic 3 - Catch-22 rule enforced by the reachability check
FR38: Epic 3 - Local play telemetry
FR39: Epic 3 - Automated guard-reachability check
FR40: Epic 3 - Phase 1–3 tuning; unambiguous time units
FR41: Epic 1 - Tap visual feedback and haptics service
FR42: Epic 8 - MVP sound effects, muted by default
FR43: Epic 8 - Phase 1–3 palettes on entry and the glyph set
FR44: Epic 8 - Countable-ant nest scene (full version, MVP by owner decision 2026-11-21)
FR45: Epic 1 - Tab bar ≤ 5, primary action, hold-repeat, steppers
FR46: Epic 1 - Decision sheet with paused timer
FR47: Epic 1 - Desktop columns and keyboard shortcuts
FR48: Epic 6 - Territory on mobile (post-MVP)
FR49: Epic 6 - Ships and planets on mobile (post-MVP)
FR50: Epic 6 - Entropy tuning (post-MVP)
FR51: Epic 7 - Transcendence ending (post-MVP)
FR52: Epic 7 - Legacy balance for the second run (post-MVP)
FR53: Epic 6 - Phase 4–5 depth and units (post-MVP)
FR54: Epic 9 - Session shape (sim schedule, Story 9.1; tuning, Story 9.9 and batch 2)
FR55: Epic 9 - DIG (Story 9.2)
FR56: Epic 9 - NEXT ROOM progress (Story 9.3)
FR57: Epic 9 - FEED (Story 9.4)
FR58: Epic 9 - Auto-dig (Story 9.5)
FR59: Epic 9 - Nest shows only dug rooms (Story 9.6)
FR60: Epic 9 - Crowding (Story 9.13)
FR61: Epic 9 - Starvation (Story 9.16; hunger on the sheet, Story 9.17)
FR62: Epic 9 - Food limit (Story 9.15; on the sheet, Story 9.17)
FR63: Epic 9 - Room jobs (Story 9.14 Gallery, 9.15 Larder, 9.16 Pantry)
FR64: Epic 9 - Rescaled goals (Phase 1–2 in Story 9.9, Phase 3+ in Story 9.18)
FR65: Epic 9 - Sim gates (report in Story 9.1; gate 1 passes in Story 9.9, gates 2–3 in Story 9.18)
FR66: Epic 9 - Resource sheet verdict and food flow (Stories 9.10–9.12; hunger parts in Story 9.17)

NFR1–NFR3, NFR7, NFR9, NFR14, NFR15: Epic 1 · NFR4–NFR6, NFR8, NFR10, NFR13: Epic 2 · NFR12: Epic 3 · NFR11: Epic 8 · UX-DR47–UX-DR51: Epic 9

## Epic List

**Order:** Epic 1 → Epic 2 → Epic 3 ↔ Epic 4 → Epic 5 → MVP playtest → Epic 9 → Epic 6 → Epic 7. Epic 8 runs alongside Epics 1–4 and starts once Epic 1's selectors and shell exist. Epic numbers match the GDD's E1–E8.

**Owner decision (2026-11-21):** the full countable-ant nest scene (UX-DR34) is MVP, which changes the GDD's E8 assumption that it was post-MVP.

### Epic 1: Play the game one-handed on a phone
Every Phase 1–3 action works in portrait on a 360×512 touch screen through at most five tabs, one primary action, and sheets that never stack. The phase changes only when the player taps CONTINUE. Brings in the foundations the shell needs: Preact, selectors, typed events, logging, boundary tests, error boundaries and debug tools.
**FRs covered:** FR1, FR13 (lifecycle), FR15 (UI), FR17, FR18, FR35, FR41, FR45, FR46, FR47

### Epic 2: Come back to a colony that kept working
Every return, from the background or a cold load, goes through one resume path with one cap and ends in a summary that offers a real decision. Saves are durable and never fail silently.
**FRs covered:** FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27

### Epic 3: Phases 1–3 pace right and never soft-lock
Phases 1–3 are reproducible, integer-clean and tuned against the GDD targets, and a CI test proves every guard is reachable.
**FRs covered:** FR2, FR3, FR4, FR5, FR6, FR7, FR33 (soft-lock), FR34, FR36, FR37, FR38, FR39, FR40

### Epic 4: Every MVP phase is worth playing
Phases 1–3 each meet the depth bar, and Combat meets the combat interest bar.
**FRs covered:** FR8, FR9, FR10, FR11, FR12, FR13 (content), FR14, FR16, FR19

### Epic 5: Prestige gives every run a clean start
Prestige wipes the run except LP, Legacy upgrades, lifetime stats and the victory record (#192), and old saves migrate.
**FRs covered:** FR28, FR29, FR30, FR31, FR32

### Epic 6: Phases 4–5 on mobile, with depth (post-MVP, placeholder)
Expansion and Space are playable one-handed and meet the depth bar. Stories are written after the MVP playtest.
**FRs covered:** FR48, FR49, FR50, FR53

### Epic 7: Transcendence and the ending (post-MVP, placeholder)
The first run ends in a real victory that offers prestige. Stories are written after the MVP playtest.
**FRs covered:** FR33 (win), FR51, FR52

### Epic 8: Each phase looks and sounds like itself
Phases 1–3 each have their own palette, glyphs, sounds and a living countable-ant nest.
**FRs covered:** FR42, FR43, FR44

### Epic 9: The first week digs in
From the 2026-11-22 playtest (Correct Course, `sprint-change-proposal-2026-11-23.md`). Session 1 runs 45–60 min with no wait wall before about 30 min, Phases 1–3 fill the first week, check-ins settle at 90–120 s after it, and the swarm grows to thousands. Batch 1 (the DIG core) and batch 2 (space and food) are written as stories; batch 3 (flavour) is listed.
**FRs covered:** FR54, FR55, FR56, FR57, FR58, FR59, FR64, FR65, FR66 (batch 1) · FR60, FR61, FR62, FR63 (batch 2)

## Epic 1: Play the game one-handed on a phone

Every Phase 1–3 action works in portrait on a 360×512 touch screen through at most five tabs, one primary action, and sheets that never stack. The phase changes only when the player taps CONTINUE. Brings in the foundations the shell needs: Preact, selectors, typed events, logging, boundary tests, error boundaries and debug tools.

### Story 1.1: Combat is the only way into Expansion

As a player,
I want every run to pass through Combat,
So that no run skips the soldiers, drops and mutations that Phase 3 introduces.

**Acceptance Criteria:**

**Given** a state in COLONY that satisfies the old shortcut (any worker count, any food)
**When** the phase machine evaluates it
**Then** no transition from COLONY to EXPANSION exists in `src/phases/transitions.ts`, and the only exit from COLONY leads to COMBAT
**And** a unit test walks the transition list and asserts each phase has exactly one successor, in the order EGG_LAYING → COLONY → COMBAT → EXPANSION → SPACE → TRANSCENDENCE

**Given** the unit and E2E specs that seed the shortcut (`phases.test.ts`, `property.test.ts`, `golden-path.spec.ts`, `phase3-expansion.spec.ts`, `expedition-buildings.spec.ts`)
**When** they run
**Then** their seeds reach EXPANSION through COMBAT, satisfying the real guards, and they pass
**And** a save that is already in EXPANSION still loads in EXPANSION (no migration moves it back)

**Covers:** FR17 · AR5 (step 1)

### Story 1.2: Errors are always logged, never swallowed

As a developer debugging a player's report,
I want every error to reach one logger,
So that a failing listener or system is visible instead of silently dropped.

**Acceptance Criteria:**

**Given** `src/utils/log.ts` with `error`, `warn`, `info`, `debug` and a 200-entry ring buffer
**When** any level is called
**Then** the entry is prefixed `[scope]`, stored in the ring buffer, and printed for `error`/`warn` always, `info` only in dev builds or with `?debug=1`, and `debug` only in dev builds
**And** the 11 direct `console.*` calls in `src/` go through `log`, and oxlint's `no-console` rule is on with `log.ts` as the only exception

**Given** an `EventBus` listener that throws
**When** the event is emitted in a production build
**Then** the other listeners still run, and the error reaches `log.error` (today it is dropped because the `process.env` check never passes under Vite)

**Covers:** AR16 (listener isolation), AR17

### Story 1.3: Events are typed and arrive after the state they describe

As a developer,
I want every event name and payload checked by the compiler and delivered after the tick's state write,
So that listeners never act on stale state or misspelled events.

**Acceptance Criteria:**

**Given** `src/engine/events.ts` with one `SwarmEvents` interface listing every event currently emitted
**When** code emits an event that is not in the interface, or with the wrong payload
**Then** `pnpm typecheck` fails (no string index signature remains)
**And** `state:changed` and `click:egg` are renamed to `snake_case` past-tense names, with all emitters and listeners updated

**Given** a system that raises an event during a tick
**When** the tick completes
**Then** the event is queued on the tick context and flushed to the bus only after `gameState.value` holds the new state, which a unit test asserts by reading state inside the listener
**And** no listener writes `gameState.value` (asserted in the boundary test once it exists; until then by a unit test on the listeners)

**Covers:** AR18

### Story 1.4: Layer boundaries are enforced by a test

As a maintainer working with AI agents,
I want import rules checked on every PR,
So that the simulation stays DOM-free and the UI stays behind selectors and actions.

**Acceptance Criteria:**

**Given** `tests/arch/architecture.test.ts`, which scans import statements with no new dependency
**When** it runs in `pnpm test`
**Then** it fails if `systems/`, `phases/`, `state/`, `data/`, `sim/` or `utils/` import a DOM API, `ui/`, `platform/` or `debug/`; if anything but `main` imports `debug/`; if `platform/` imports more than types from game layers; or if `Math.random` appears in `systems/` or `sim/`
**And** it fails if a file under `ui/` writes `gameState.value`, or reads it outside an allowlist of legacy files (`ui/UIRoot.ts`, `ui/panels/*`, `ui/components/*`)

**Given** the legacy allowlist
**When** a legacy file is deleted or migrated
**Then** its entry must be removed (the test fails on allowlist entries for files that no longer exist), so the list only shrinks
**And** existing `Math.random` uses in `systems/` are listed as known exceptions with a pointer to Story 3.1, and the list may only shrink

**Covers:** AR21

### Story 1.5: The UI reads game state through selectors

As a player on a phone,
I want the interface to update only the parts that changed,
So that taps stay responsive while the game ticks 20 times a second.

**Acceptance Criteria:**

**Given** `src/state/selectors.ts` exporting `computed` slices named `select<Noun>`
**When** a tick changes only food
**Then** a selector for an unrelated slice (for example buildings) does not notify, which a unit test asserts by counting notifications (#186)
**And** every effect in `src/ui/` that depended on `gameState.value` now depends on a selector

**Given** `src/state/StateManager.ts`, `Store.ts` and `GameStatePool.ts`
**When** this story lands
**Then** all three and their tests are deleted, `GameStatePool.spread()` call sites use plain spreads, and the game still runs one spread write per tick
**And** the boundary test's legacy allowlist does not grow

**Covers:** AR8 · NFR1

### Story 1.6: Player intents go through actions that explain refusals

As a player,
I want a refused tap to tell me why,
So that "can't afford" or "no free workers" is never a silent no-op.

**Acceptance Criteria:**

**Given** `src/actions/` with one function per existing player intent (lay egg, assign/unassign workers, buy building, buy upgrade, start/cancel research, train soldiers, fight, buy mutation, recruit, start expedition, prestige)
**When** an intent is valid
**Then** the action writes the new state between ticks (one spread write) and returns `{ ok: true }`
**And** when it is invalid it returns `{ ok: false, reason }` with a typed reason (`cannot_afford`, `no_free_workers`, `at_capacity`, `slots_full`, …) and leaves the state reference unchanged

**Given** the legacy panels
**When** a button is pressed
**Then** it calls the action instead of a system, and the boundary test enforces that `ui/` never imports `systems/`

**Given** state that has a lifecycle (research, battles, expeditions, explorations)
**When** an action or system touches it
**Then** it is modelled as a discriminated union on `status` with game-time ms (never wall clock), created by pure factories returning plain JSON data with sequential or content IDs (no random IDs), so `JSON.parse(JSON.stringify(state))` round-trips (unit test)

**Covers:** AR16 (expected outcomes), AR22, AR23

### Story 1.7: The UI renders through Preact

As a maintainer,
I want a Preact root hosting the existing panels,
So that panels can migrate one at a time without breaking E2E specs.

**Acceptance Criteria:**

**Given** `preact` and `@preact/signals` added, `tsconfig.json` set to `"jsx": "react-jsx"` and `"jsxImportSource": "preact"`, and Vite's built-in JSX transform (add `@preact/preset-vite` only if its peer range covers Vite 8; check with Context7)
**When** `pnpm install` and `pnpm build` run
**Then** a test (or CI step inside an existing job) fails if more than one version of `@preact/signals-core` is installed
**And** `src/main.tsx` mounts `ui/App.tsx`, which hosts the legacy `UIRoot` unchanged, and every existing E2E spec passes without selector changes

**Given** a Preact component reading a selector
**When** the slice changes
**Then** only that component re-renders (component test with Preact Testing Library)

**Covers:** AR1, AR26 · ADR 0004

### Story 1.8: Every phase repaints the interface from one token set

As a player,
I want each phase to have its own single-color look,
So that entering a phase feels like a reveal.

**Acceptance Criteria:**

**Given** `ui/styles/tokens.css` defining the 6 phase palettes from DESIGN.md front matter (7 values each, plus `scrim`) and runtime aliases (`--color-bg`, `--color-raised`, `--color-line`, `--color-edge`, `--color-dim`, `--color-accent`, `--color-warn`, `--color-on-accent`)
**When** the phase changes
**Then** only the alias bindings change (one attribute on the root), and no component stylesheet references a phase hex directly (a test greps `ui/` CSS for phase hex values)
**And** no color, name or picture from a later phase is reachable before that phase is entered

**Given** the DESIGN.md contrast table
**When** the token test runs
**Then** it recomputes every pair's WCAG ratio from the tokens and fails if any falls below the stated minimum (accent/bg ≥ 7.7, dim/raised ≥ 5.3, edge/bg ≥ 3.0, …)

**Covers:** UX-DR1

### Story 1.9: Numbers read cleanly at phone size

As a player,
I want counts that fit their cell and never round up,
So that I can trust the number I'm about to spend.

**Acceptance Criteria:**

**Given** `utils/format.ts` exporting `formatInt` (floors), `formatStrip` and `formatFull`
**When** a value is formatted for the strip
**Then** it shows full digits up to 9 999 and 5-character suffixes above (`12.4K`, `124K`, `1.24M`), never more than 5 characters
**And** `formatFull` shows full digits with space grouping up to 999 999, then suffixes; neither uses scientific notation before Transcendence

**Given** any non-negative input, including fractions
**When** it is formatted
**Then** the displayed value is never greater than `Math.floor(input)` at the shown precision (property test)

**Covers:** FR35 · UX-DR3

### Story 1.10: Settings, device capabilities and haptics as platform services

As a player,
I want my preferences kept separately from my run,
So that prestige or importing a save never resets how the game behaves for me.

**Acceptance Criteria:**

**Given** `src/platform/settings.ts` (one signal, key `the_swarm_settings`, its own version) and `src/platform/capabilities.ts` (vibrate, standalone, reduced motion, more contrast, detected once at boot)
**When** the game boots with no settings key
**Then** defaults apply: sound off, haptics on where supported, reduced motion following the OS, CRT SCENE, decision timers normal, confirm style hold (1 s), lay mode hold, keyboard shortcuts on
**And** settings survive prestige and save import and are not included in a save export

**Given** a `Haptics` interface with a web implementation
**When** a light, medium, heavy or double pattern is requested
**Then** it calls `navigator.vibrate` where available and is a no-op otherwise, never throwing, and respects the haptics setting
**And** game layers receive platform services only through what `main` passes in (boundary test)

**Covers:** AR12 (settings, capabilities, haptics) · FR41 (haptics)

### Story 1.11: Buttons that answer within 100 ms and can be held

As a player tapping with one thumb,
I want buttons to react instantly and repeat while held,
So that buying ten of something isn't ten taps.

**Acceptance Criteria:**

**Given** `ui/primitives/Button` with primary, secondary and disabled variants
**When** it is pressed
**Then** it shows the pressed (inverse) state on pointer-down, before any state write, and keeps it until release without re-inverting on each repeat
**And** the action fires on pointer-up, so dragging off cancels it; disabled buttons show a dashed `edge` border and their reason on the cost line, with no opacity fade

**Given** a hold on a repeatable action (buy, assign, lay)
**When** the pointer stays down
**Then** the action repeats at about 8 per second and speeds up after 1 s, each repeat going through the same action and stopping at the first refusal
**And** a primary action shows `> ` before its label and a block cursor that blinks at 1 Hz for at most 5 s after input (steady under reduced motion); a long label truncates the target name, never the verb

**Given** a 2 s hold on a primary action
**When** a test samples the element's luminance
**Then** it changes no more than 3 times in any 1 s window (flash rule)
**And** every focusable control has a 2 px `accent` outline at a 2 px offset when focused

**Covers:** FR45 (hold-repeat), UX-DR11, UX-DR20, UX-DR38 · NFR1

### Story 1.12: Steppers, cards, meters, toasts and coach marks

As a player,
I want the same controls to behave the same way on every screen,
So that I learn them once.

**Acceptance Criteria:**

**Given** `ui/primitives/Stepper`
**When** `[−]` or `[+]` is tapped with the ×1, ×10 or ×MAX multiplier active
**Then** the change applies immediately, the value stays between 0 and what is available, and holding repeats (via Story 1.11)
**And** each bracket is a 44 px target with an accessible name supplied by the caller ("Add one gatherer")

**Given** `ui/primitives/Card`
**When** a card renders
**Then** only its action is tappable; an unaffordable card shows its shortfall in `warn` (`needs 60 more` plus glyph), and the first time it becomes affordable its border highlights for 2 s

**Given** `Meter`, `Toast` and `CoachMark` primitives
**When** they render
**Then** a meter is `role="progressbar"` with `aria-valuetext`, its cells `aria-hidden`; a toast shows one line for 2 s and replaces any earlier toast; a coach mark is shown once per concept (remembered in settings), is dismissed by the action it points to or `[ GOT IT ]`, consumes the dismissing tap and is announced politely

**Covers:** FR45 (steppers), UX-DR15 (stepper), UX-DR17, UX-DR29

### Story 1.13: Irreversible actions need a hold or two taps

As a player,
I want irreversible actions to need a deliberate confirm,
So that a stray tap never costs me a run.

**Acceptance Criteria:**

**Given** `ui/primitives/HoldToConfirm` in hold mode (the default, 1 s, adjustable in settings)
**When** the player holds it
**Then** a square ring of block cells fills clockwise and the action fires only when the ring completes; releasing early drains the ring and does nothing
**And** holding Enter or Space on the focused control behaves the same way

**Given** two-tap mode in settings
**When** the player taps once
**Then** the button re-labels `> TAP AGAIN TO <VERB>` in inverse video for 5 s; a second tap within 5 s fires, otherwise it disarms

**Given** prestige, research cancel and save import
**When** each is triggered
**Then** it goes through `HoldToConfirm` (prestige and research cancel migrate in this story; save import uses it in Story 2.11)

**Covers:** UX-DR21

### Story 1.14: One sheet at a time

As a player,
I want overlays to queue rather than pile up,
So that I'm never facing two dialogs at once.

**Acceptance Criteria:**

**Given** `ui/shell/SheetController` (one signal holding the open sheet and a queue) and modal and peek sheet components
**When** two sheets are requested together
**Then** the higher-priority one opens first (offline summary > decision event > battle summary > other modal > peek), the other waits, and modal sheets never stack; opening a modal closes any peek
**And** a modal sheet has a scrim, handle, `display` headline and at most two actions, and closes by swipe down, scrim tap, `[ CLOSE ]` or Esc, unless it is a decision sheet

**Given** an open modal sheet
**When** it opens and closes
**Then** it is `role="dialog"` with `aria-modal`, focus moves to the headline and is trapped inside, and focus returns to the trigger on close

**Given** the legacy `OfflineSummaryPopup` and `DecisionPopup`
**When** this story lands
**Then** both render as sheets through the controller with their current behavior, and the E2E specs that drive them pass with their existing `data-*` hooks

**Covers:** AR10 (SheetController), UX-DR22

### Story 1.15: Five tabs, one primary action, thumb-reachable

As a player holding the phone in one hand,
I want every screen reachable from a bottom tab bar with its main action under my thumb,
So that the whole game works one-handed.

**Acceptance Criteria:**

**Given** a tab registry in `data/content/tabs.ts` (`{ panelId → tab, segment?, unlockPhase }`) replacing `PHASE_PANELS` in `PhaseContent.ts`, and the consolidation table in EXPERIENCE.md
**When** each phase is rendered
**Then** Phase 1 shows no tab bar, entering Colony reveals NEST · WRKR · BUILD · LOG at once, Combat adds FRONT, and a test asserts that no phase shows more than 5 tabs
**And** each legacy panel is hosted in its destination tab, keeping its `data-*` and `id` hooks

**Given** the portrait skeleton at 360×640 and 360×512
**When** any tab is shown
**Then** the strip is at the top, the primary zone (64 px) and tab bar (52 px) are pinned in the bottom 40% of `100dvh` above the safe-area inset, and scroll areas are padded by their combined height
**And** the active tab is inverse video, tapping it scrolls to top, a tab shows `•` when something on it became affordable since the last visit (cleared on visit), there are no numeric badges, and each tab keeps its scroll position for the session

**Covers:** FR45 (tab bar, primary action), AR10 (tab registry), UX-DR5, UX-DR9 · NFR9, NFR14

### Story 1.16: The resource strip and resource sheet

As a player glancing at my phone,
I want the five numbers that matter now at the top, and every number one tap away,
So that I see what changed without hunting.

**Acceptance Criteria:**

**Given** the strip's per-phase sets (P1 EGG LRVA WRKR FOOD; P2 FOOD WRKR WOOD STON NECT; P3+ capped or falling resources first)
**When** the game ticks
**Then** each cell shows a glyph, a label of at most 4 letters (accessible name is the full word), the value via `formatStrip` and the delta (no `/s`, negatives in `warn` with `−`), refreshed at most 4 times a second
**And** a capped value turns `warn` with ▲, and above about 125% text scale the strip shows 3 cells plus a `+2 ▸` cell

**Given** a tap on the strip
**When** the resource sheet opens
**Then** it lists every unlocked resource with its full name, exact integer (`formatFull`), rate (unit stated once in the header), cap and source, and ends with `[ SETTINGS ⚙ ]`
**And** `ResourcePanel` and the rate part of `FoodDisplay` are replaced by these components

**Covers:** UX-DR7, UX-DR8

### Story 1.17: A bug in a tick never corrupts the run

As a player,
I want a failing tick to leave my colony as it was,
So that a bug costs me a moment, not my save.

**Acceptance Criteria:**

**Given** `GameLoop` running `processTick`
**When** a system throws
**Then** that tick's write is discarded (the state reference is unchanged), the error goes to `log.error`, and the next tick runs normally

**Given** 3 consecutive failed ticks
**When** the third fails
**Then** the simulation stops and a sheet offers EXPORT SAVE and RELOAD
**And** the save written afterwards is the last good snapshot, never the failing state (unit test with a system stubbed to throw)

**Covers:** AR16 (tick boundary)

### Story 1.18: The goal meter shows each condition of the next goal

As a player,
I want to see exactly what's left before the next phase,
So that I know what to work on without the game naming what comes next.

**Acceptance Criteria:**

**Given** each `Transition` in `transitions.ts` with `conditions: { id, label, current(s), target(s) }[]` and `guard` derived as all conditions met
**When** any state is evaluated
**Then** the derived guard equals the old boolean guard for that transition (property test over random states)
**And** no threshold number appears outside `transitions.ts` (boundary test)

**Given** NEST
**When** the goal meter renders
**Then** it reads `NEXT: <conditions>` with one row per condition showing `met`/`need`, ✓/✗ and `current/target`, never naming the next phase; the rows are a list whose items read "met" or "not met"
**And** every other tab shows the condensed one-line meter (`NEXT ████······ 74%`), replacing `PhaseIndicator`

**Covers:** AR5 (conditions), UX-DR13 (meter)

### Story 1.19: The phase changes only when I tap CONTINUE

As a player,
I want to choose the moment I enter the next phase,
So that a reveal never happens while I'm not looking.

**Acceptance Criteria:**

**Given** `PhaseStateMachine` split into a pure `evaluate(state) → Transition | null` (run every tick) and `commit(transition, state, bus)` (runs `onEnter`, emits `phase_committed`, which replaces today's `phase_changed` in every emitter and listener)
**When** a guard becomes true
**Then** the phase does not change; `state.phaseGoal = { phase, latched: true }` is written once, NEST gets `•`, and its primary action becomes `> CONTINUE` (`data-action="continue"`)
**And** only `commit` (or prestige) assigns `state.phase` (asserted in the boundary test)

**Given** a latched goal whose numbers dip below target
**When** the meter renders and the game is saved and reloaded
**Then** the goal still reads `GOAL MET`, the dipped row reads `<now> now, reached <value> at <time>`, and CONTINUE still commits
**And** the latch is cleared by `commit` and by prestige

**Given** save version 13
**When** it loads
**Then** a numbered migration adds `phaseGoal` (null, or latched if the save's guard is already met) without renumbering existing steps
**And** the ~7 E2E specs and 4 unit files that relied on auto-transition now tap `[data-action="continue"]` and pass

**Covers:** FR18, AR5 (evaluate/commit, latch), AR23 (only commit assigns the phase), UX-DR13 (latch), UX-DR14 · ADR 0003

### Story 1.20: The phase reveal

As a player who just tapped CONTINUE,
I want a short, full-screen reveal of the new phase,
So that each phase change feels like an event.

**Acceptance Criteria:**

**Given** `ui/shell/OverlayHost` and a `PhaseReveal` overlay
**When** CONTINUE commits a phase
**Then** the overlay blocks input for at most 3.5 s, cross-fades the palette over 3 s (300 ms under reduced motion), shows the phase name in `display` and types in one line, then releases
**And** decision events and sheets requested meanwhile wait until it ends

**Given** `lifetime.revealsSeen` in the save (added by a numbered migration)
**When** a reveal plays for the first time
**Then** it cannot be skipped; once seen, a tap, Enter or Esc skips it
**And** the legacy overlay's `pointer-events: none` is gone

**Covers:** AR10 (overlay layer), UX-DR27

### Story 1.21: The game suggests the one most useful next action

As a player with 30 seconds,
I want the game to put the single most useful action under my thumb,
So that every check-in has an obvious next move.

**Acceptance Criteria:**

**Given** a pure `getNextAction(state)` in `systems/NextAction.ts` and one critical-path table per phase in `data/content/criticalPath.ts`
**When** it is evaluated
**Then** the first matching rule wins: goal met → CONTINUE; food critical (net food rate < 0 and stock under 60 s of upkeep) → the allocation fix; capacity ≥ 95% → DIG or Warehouse; an affordable critical-path item; any affordable item; otherwise none, with `NEXT AFFORDABLE: <item> IN ~<time>`
**And** unit tests cover each rule's precedence with `makeState` overrides, and thresholds come from `data/balance/`, not from the tests

**Given** the primary action showing a suggestion
**When** the player is holding it or tapped within the last 1 s
**Then** the target does not change under the thumb

**Covers:** UX-DR12

### Story 1.22: The NEST tab

As a player,
I want the home screen to show what changed, how close the goal is, what just happened and what to do,
So that a check-in starts with everything in view.

**Acceptance Criteria:**

**Given** NEST in Phase 1
**When** it renders
**Then** the order top to bottom is strip deltas, phase line and goal meter, a scene area (placeholder until Story 8.5), event lines and the primary action `> LAY EGG`
**And** tapping lays an egg through the action with a visual response and a light haptic, holding repeats (or toggles, in toggle lay mode), and the Click Power card appears under the event lines once first affordable, without changing the primary action

**Given** NEST after Phase 1
**When** it renders
**Then** the primary action follows `getNextAction`, and when no action exists the zone shows `NEXT AFFORDABLE: <item> IN ~<time>`
**And** event lines show the newest 3 (1 below 560 px viewport height), newest prefixed `> ` in accent, older `· ` in dim; `ClickButton` and the NEST part of `EventLog` are replaced, keeping `#click-egg`

**Covers:** FR1, FR41 (tap feedback), UX-DR18 (Phase 1), UX-DR30 (NEST lines)

### Story 1.23: The WRKR tab

As a player,
I want to split my workforce with steppers and see upkeep live,
So that allocation, the core skill, is quick on a phone.

**Acceptance Criteria:**

**Given** WRKR with one role row per role in the role data (Gather, Tend, Dig, Guard, Research; Forage appears automatically when Story 3.4 adds it)
**When** it renders
**Then** each row shows the role name, a text bar (`█` per worker up to 16 cells, then scaled; `aria-hidden`), the count and a stepper, with the `×1 ×10 ×MAX` multiplier row above
**And** `[+]` is disabled with `no free workers` when none are free, while reassigning still works; ×MAX respects capacity, and Research counts toward the assigned total

**Given** any assignment change
**When** it applies
**Then** the upkeep readout `UPKEEP n / PRODUCTION n` and its net (negative in `warn` with ▼) update on the same frame
**And** the primary action is the single most useful reallocation when one exists (for example `> MOVE 4 TO GATHER`), otherwise none; `WorkerAssignment`, the upkeep part of `FoodDisplay` and `AutoProductionPanel` are replaced, keeping `[data-role]` and `.role-count`

**Covers:** UX-DR15

### Story 1.24: The BUILD tab

As a player,
I want buildings, research and the converter as cards with clear costs,
So that I can see what to buy next and what I'm short of.

**Acceptance Criteria:**

**Given** BUILD
**When** it renders
**Then** buildings, research and the resource converter appear as cards (title with glyph and level change, effect line, cost line with shortfall), the highlighted card's action is the tab's `> BUY`, and from Phase 2 the Click Power card lives here
**And** when nothing is affordable the header reads `NEXT: <item> IN ~<time>`

**Given** a research card
**When** the player starts a chain step
**Then** it shows a progress meter and time remaining; while running its action is `CANCEL (50 % BACK)` through `HoldToConfirm`, with the refund shown before confirming, and cancelling refunds 50%
**And** `BuildingPanel`, `ResearchPanel`, `TechTreePanel` and `ResourceConverterPanel` are replaced, keeping `#building-panel` and `#research-panel`

**Covers:** FR15 (UI), UX-DR17, UX-DR18 (Phase 2+), UX-DR19

### Story 1.25: The FRONT tab and its WAR segment

As a player in Combat,
I want soldiers, the enemy and my upgrades on one screen,
So that preparing for a fight takes a few taps.

**Acceptance Criteria:**

**Given** FRONT, which appears in Combat
**When** later phases are reached
**Then** its segment row grows WAR → WAR · MAP → WAR · MAP · STARS, opens on the newest segment, remembers the last used for the session, and each segment is a 44 px target
**And** MAP and STARS host the legacy expedition, map, spaceship, star-map, exploration and cosmic panels unchanged (their mobile rework is Epic 6)

**Given** the WAR segment
**When** it renders
**Then** it shows soldiers and training, equipment, mutations, the enemy card and the combat log, with `> FIGHT` as the primary action, disabled with `train soldiers first` when there are no soldiers, and a round counter on the enemy card while a battle runs
**And** `SoldierPanel`, `BattlePanel`, `CombatLogPanel` and `MutationPanel` are replaced, keeping `#soldier-panel` and `#battle-panel`

**Covers:** UX-DR10, UX-DR26 (card and states)

### Story 1.26: The LOG tab keeps the colony's history

As a returning player,
I want a full log of what happened that survives reloads,
So that I can read what the colony did while I was away.

**Acceptance Criteria:**

**Given** the event log
**When** a line is added
**Then** it is stored in the save (last 100 lines, via a numbered migration), newest first, and tapping a line that points at something jumps to it

**Given** LOG
**When** it renders
**Then** it shows the full log (never empty after Phase 1), lifetime stats and a settings entry, and a LEGACY section once the GDD's prestige unlock condition is met, hosting the prestige and Legacy-tree panels with prestige behind `HoldToConfirm`
**And** `EventLog`, `PrestigePanel` and `PrestigeTreePanel` move here, keeping `#prestige-panel`

**Covers:** UX-DR30 (persisted log), UX-DR31

### Story 1.27: The settings screen

As a player,
I want to control sound, motion, timers and confirmations,
So that the game fits my situation and needs.

**Acceptance Criteria:**

**Given** the settings screen, reached from the resource sheet's `[ SETTINGS ⚙ ]` (so it works in Phase 1) and from LOG
**When** it renders
**Then** it offers sound, haptics, reduced motion, CRT effects (SCENE/FULL/OFF, with FULL stating that contrast is reduced), decision timers (normal/×2/off), confirm style plus hold duration, lay mode (hold/toggle), keyboard shortcuts (on/off, remap), replay intro, and export diagnostics
**And** it has no notifications toggle on the web build, and every change writes to the settings store immediately

**Covers:** UX-DR32 (screen)

### Story 1.28: Decision events wait for me, even if I close the app

As a player,
I want a pending decision to pause when I leave and come back with me,
So that closing the app is neither a penalty nor a free escape.

**Acceptance Criteria:**

**Given** events declared as data in `data/content/decisions.ts` (`{ id, phases, ignorePolicy: 'free' | 'costly' | 'unavoidable', timerMs?, ignoreLine, choices[], ignore? }`), with the 3 existing events converted
**When** the game runs in the foreground
**Then** an event spawns only after at least 2 minutes of foreground play this session (the spawn timer resets each session, timing seeded), at most one is open, and none spawns while an overlay or the offline summary is up
**And** choices and timeouts go through one pure `applyChoice(state, event, choice | 'ignore')`

**Given** an open timed event
**When** the app is hidden, closed and reopened
**Then** its countdown, which runs on game time, has paused; `state.decision.open` with `remainingMs` is in the save (numbered migration); and it reopens on resume after any offline summary with the same time left
**And** the countdown does not run while the sheet waits behind another sheet or overlay

**Given** the decision sheet
**When** it renders
**Then** it shows the situation, 2 choices with visible cost or risk, a timer meter when timed and the `IGNORE: <outcome>` line; it cannot be closed with Esc; a costly timeout writes the outcome to the log and toasts once; unavoidable events have no timer and no dismiss
**And** the decision-timer setting doubles or removes timers for free and costly events, and the first timed event shows `TIMERS CAN BE SLOWED IN SETTINGS` once

**Covers:** FR13 (lifecycle), FR46, AR11 (lifecycle), UX-DR23 · N3

### Story 1.29: The same game in columns on desktop

As a desktop player,
I want the nest and the active tab side by side,
So that a wide screen isn't wasted.

**Acceptance Criteria:**

**Given** a viewport of at least 1024 px
**When** the game renders
**Then** a 160 px left text rail with full tab names and number-key hints replaces the tab bar, NEST stays in column 1 and the active tab fills columns 2–3 (BUILD on first visit), each column ending in its own primary zone, content at most 1280 px wide
**And** sheets render as centered dialogs at most 480 px wide, and picking NEST in the rail focuses column 1 and leaves columns 2–3 on the last tab

**Given** 600–1023 px
**When** the game renders
**Then** it is the single-column layout centered at 600 px

**Covers:** FR47 (layout), UX-DR6

### Story 1.30: Keyboard shortcuts

As a desktop or keyboard player,
I want keys for the primary action, tabs, pause and closing sheets,
So that I can play without the mouse.

**Acceptance Criteria:**

**Given** shortcuts on in settings
**When** the player presses a key with focus on the page or the primary button
**Then** Space triggers the active tab's primary action (on desktop, the action in columns 2–3), 1–5 switch tabs, P pauses (Space no longer pauses) and Esc closes a non-decision sheet
**And** Space on a focused control (a stepper, a card action) activates that control instead

**Given** shortcuts switched off or remapped in settings
**When** keys are pressed
**Then** disabled shortcuts do nothing and remapped ones follow the new binding
**And** anything shown on hover is exactly what a tap shows, and stays dismissible and hoverable (WCAG 1.4.13)

**Covers:** FR47 (shortcuts), UX-DR41

### Story 1.31: Text reflows at large sizes and narrow screens

As a player using large text or a small phone,
I want text to wrap rather than clip,
So that I can read everything at 200% zoom or 320 px wide.

**Acceptance Criteria:**

**Given** the character grid `cols = floor(contentWidth / advanceWidth(body))`
**When** columns are 36 or more
**Then** panels render as designed; at 28–35 meters shrink to `cols − 8` cells and two-column rows stack; below 28 box-drawing becomes 1 px CSS borders, text wraps, meters become `74 % ████····` and aligned tables become label-over-value stacks

**Given** viewports of 320 px wide, 200% text, a height below 560 px and below 480 px (landscape)
**When** each tab is checked in Playwright
**Then** there is no horizontal scrolling and no clipped text; below 560 px NEST shows 1 event line and primary actions carry their cost line inside; below 480 px the primary zone un-pins and content scrolls
**And** zoom is never disabled, sizes are in rem, and margins drop from 14 px to 8 px below 360 px

**Covers:** UX-DR4, UX-DR5 (height rules), UX-DR6 (landscape) · NFR7

### Story 1.32: Screen readers and reduced motion get the full game

As a player using assistive technology or reduced motion,
I want every state and change available to me,
So that the terminal look never hides information.

**Acceptance Criteria:**

**Given** the shell and tabs
**When** they are audited (axe in Playwright plus targeted unit tests)
**Then** typed decoration (`>`, `·`, `█`, brackets, box-drawing, text meters) is `aria-hidden`, labels expose full words ("Stone"), aligned rows use real list or table markup, and typing effects are visual only (the accessible node holds the full string from the start)
**And** polite live regions announce goal met, phase entered, battle result, decision arrived (the sheet takes focus), costly ignore applied, starving, capacity reached and save failed, and resource values are never announced per tick

**Given** keyboard navigation
**When** the player tabs through a screen
**Then** focus order is strip → phase line and goal meter → scene summary → event lines → primary action → tab bar (desktop: rail → column 1 → columns 2–3), and focused items are never hidden behind the primary zone

**Given** reduced motion (OS or setting)
**When** the game renders
**Then** typing effects, floating `+N` and easing are off, palette fades take 300 ms, the cursor is steady and CRT effects are OFF
**And** hue never carries meaning alone: every loss or warning has `−`, ▼ or a word

**Covers:** UX-DR39, UX-DR40 · NFR15

### Story 1.33: The game speaks in one voice

As a player,
I want terse, consistent copy,
So that the game reads like a terminal watching an ant farm, not a slot machine.

**Acceptance Criteria:**

**Given** every player-facing string in `src/`
**When** a test scans them
**Then** none contains an exclamation mark, `Overcrowding!` reads `OVERCROWDING.`, and no copy names a phase the player hasn't entered
**And** colony lines are upper case and present tense, interface copy is plain, and abbreviations have full-word accessible names

**Covers:** UX-DR42

### Story 1.34: Debug overlay and dev cheats

As a developer reproducing a bug on a phone,
I want an overlay with timings and state, and cheats in dev builds,
So that I can see and reproduce what the player saw.

**Acceptance Criteria:**

**Given** a dev build, or production with `?debug=1`
**When** the backtick key or a 3-finger long-press is used
**Then** an overlay shows FPS, tick time p50/p95, catch-up time, seed and save version, plus a read-only state inspector and a log viewer
**And** "export diagnostics" (logs, state, seed, build hash) is available here and in settings for everyone

**Given** a dev build
**When** `window.__swarm` is used
**Then** it can add resources, set the phase, time-skip N hours and set the seed
**And** a production build contains none of the cheat code (a build test greps the bundle), and nothing but `main` imports `debug/`

**Covers:** AR24

### Story 1.35: CI fails on high-severity production vulnerabilities

As the owner,
I want a production-dependency audit in CI,
So that nothing vulnerable ships to players.

**Acceptance Criteria:**

**Given** `.github/workflows/ci.yml`
**When** this story lands
**Then** `pnpm audit --prod --audit-level=high` runs as a step inside an existing job, with no new job key, no job-level `name:`, no `|| true` and no `--if-present`
**And** Dependabot groups development-dependency updates into one PR (daily schedule, owner decision 2026-11-21)

**Covers:** AR25

### Story 1.36: The legacy UI is gone

As a maintainer,
I want the old panel system removed once every panel has a home,
So that agents can't copy the old patterns.

**Acceptance Criteria:**

**Given** that every panel in the consolidation table has been migrated by Stories 1.14–1.28 and Epic 6 still hosts the Phase 4–5 panels inside FRONT
**When** this story lands
**Then** `src/ui/UIRoot.ts`, every migrated file under `src/ui/panels/` and `src/ui/components/`, and `PHASE_PANELS` are deleted, and the remaining Phase 4–5 panels are mounted directly by their FRONT segment
**And** the boundary test's legacy allowlist contains only those remaining Phase 4–5 panels, and every E2E spec passes

**Covers:** AR26 (removals)

## Epic 2: Come back to a colony that kept working

Every return, from the background or a cold load, goes through one resume path with one cap and ends in a summary that offers a real decision. Saves are durable and never fail silently.

### Story 2.1: Saves from every shipped version keep loading

As a player with an old save,
I want my run to load after every update,
So that the rework never costs me progress.

**Acceptance Criteria:**

**Given** `tests/saves/` with one fixture per shipped save version (v1 up to the version before the current one, including the versions Epic 1 adds; today `tests/saves/` holds v5–v7 and `tests/snapshots/` holds v1–v11 for `saveCompatibility.test.ts`, so reuse those and add v12 onward), each a real save shape for that version
**When** the migration test runs
**Then** every fixture migrates step by step to the current version, loads through `SaveManager`, and the result passes the state invariants (integer resources ≥ 0, a valid phase, pipeline counts ≥ 0)
**And** a test fails if `SAVE_VERSION` is raised without a fixture for the previous version

**Given** a missing historical shape that can't be rebuilt from git history
**When** the fixture would be invented
**Then** the version is listed in the test as explicitly retired, with the reason, instead of faked

**Covers:** AR7 · NFR8

### Story 2.2: A save that can't be read is never silently reset

As a player,
I want to be told when my save is damaged and offered the backup,
So that a bad write never wipes my run without my say.

**Acceptance Criteria:**

**Given** a `SaveStore` interface in `src/platform/storage/` with a localStorage implementation (same key, same 2-slot rotating backup)
**When** `load()` runs
**Then** it returns `{ status: 'ok' | 'recoveredFromBackup' | 'unreadable' | 'empty', state? }`, and game code no longer touches `localStorage` directly (boundary test)

**Given** `unreadable` (parse error or a migration that throws)
**When** the game boots
**Then** the sheet `THIS SAVE COULDN'T BE READ.` offers LOAD BACKUP and START OVER, and nothing is overwritten until the player chooses
**And** `recoveredFromBackup` logs a `warn` and tells the player once with a toast

**Given** a save write that fails (quota or storage error)
**When** it happens
**Then** the strip shows a persistent `• SAVE FAILED` marker; tapping it explains and offers EXPORT SAVE; the marker clears after the next successful write
**And** the game keeps running and the last good save is untouched

**Covers:** AR6 (SaveStore, load status), UX-DR33 (corrupt, save failed) · NFR8

### Story 2.3: Every return goes through one resume path

As a player who switches apps all day,
I want time away handled the same way whether I backgrounded the app or closed it,
So that progress never depends on how I left.

**Acceptance Criteria:**

**Given** a `Lifecycle` platform service listening to `visibilitychange` and `pagehide`
**When** the page is hidden
**Then** the game saves with a `lastSeenAt` wall-clock timestamp and stops the ticker; `beforeunload` remains only as a fallback; nothing is simulated while hidden

**Given** a cold load or a return to visible
**When** the game resumes
**Then** it calls `resume(elapsedMs)` exactly once, with `elapsedMs` from `lastSeenAt` (negative values treated as 0)
**And** a gap under 60 s is simulated at full efficiency with no summary sheet; 60 s or more is handed to the offline path at the current offline efficiency

**Given** a visible tab whose frame gap exceeds 1 s (a stall, or a throttled tab that never fired `visibilitychange`)
**When** the next frame arrives
**Then** the gap goes to `resume(gap)` instead of being dropped by the 1 s frame cap

**Covers:** FR22, AR2, AR12 (lifecycle) · NFR3, NFR5 · ADR 0002

### Story 2.4: One offline cap

As a player who sleeps,
I want one clear limit on how long the nest keeps working,
So that I know what to expect when I return.

**Acceptance Criteria:**

**Given** `getOfflineCapMs(state)` returning 12 h at baseline (value in `data/constants.ts`), plus any cap raise from owned Legacy upgrades (none exist until Story 2.8; the function already sums them)
**When** any elapsed time is resumed
**Then** at most `getOfflineCapMs(state)` of it is simulated
**And** the 4 h cap in `OfflineProgression.ts`, the 8 h accumulator cap in `GameLoop.ts` and the 1 s frame cap in `Ticker.ts` no longer limit resumed time (a test greps for no other cap constants)

**Given** a gap longer than the cap
**When** the summary is built
**Then** it knows the cap was reached and which cap value applied

**Covers:** FR20, AR3

### Story 2.5: Systems give the same result for any step length

As a player,
I want a long absence to produce what the same time would produce in play,
So that coming back is never better or worse than staying.

**Acceptance Criteria:**

**Given** `processTick(state, ctx, dt)` with `dt` as a step length
**When** any system advances by one step of `n × 50 ms` versus `n` steps of 50 ms
**Then** a seeded property test over random states finds the results within a stated tolerance for rates, and exactly equal on integer invariants (resources are integers ≥ 0, no pipeline loses items: every exit feeds the next pipeline)
**And** amounts are floored where credited or spent, with fractional carry kept only in pipeline `progress` or `*Remainder` fields

**Covers:** FR2 (pipelines under any step), AR4 (systems correct for any `dt`)

### Story 2.6: A 24-hour absence catches up fast

As a player opening the app after a day away,
I want the colony ready within half a second,
So that a check-in doesn't start with a wait.

**Acceptance Criteria:**

**Given** the offline path of `resume(elapsedMs)`
**When** it runs
**Then** it advances in macro-steps (initial `dt` 10 s, in `data/constants.ts`) through the same `processTick` the game uses, logging one summary line, not one per step
**And** a CI test asserts that a 24 h catch-up calls `processTick` at most a fixed number of times (from `data/constants.ts`), never asserting wall-clock time

**Given** `pnpm perf`
**When** it runs on the reference phone (about 2022 mid-range Android)
**Then** it reports the 12 h and 24 h catch-up times against the 500 ms budget; it is not part of CI

**Covers:** AR4 (macro-steps, step budget) · NFR4

### Story 2.7: Offline time follows its own rules

As a player,
I want offline time to keep my colony alive without making choices for me,
So that the worst absence costs time, never my workforce.

**Acceptance Criteria:**

**Given** an offline catch-up
**When** it runs
**Then** no decision event spawns or counts down, no phase commit happens (the goal latch may set), and events go to a collecting bus so nothing plays or animates
**And** player-set automation targets run as configured

**Given** a starvation scenario during catch-up
**When** it completes
**Then** workers are never below `floor(0.5 × workers before the absence)` (property test over random states and durations)
**And** the floor does not apply to foreground play

**Covers:** FR24, AR4 (offline-only rules)

### Story 2.8: Offline efficiency grows from 50% to 100%

As a first-run player,
I want offline efficiency I can improve during this run,
So that coming back is rewarded before my first prestige.

**Acceptance Criteria:**

**Given** a new run
**When** offline time is simulated
**Then** efficiency is 50%; a research project available in Phase 2–3, paid in that phase's currencies, raises it to 75%; a Legacy upgrade raises it to 100%; Legacy upgrades also raise the cap from 12 h toward 24 h
**And** the research is wiped on prestige like other research, while the Legacy upgrades are kept

**Given** a save that owns Temporal Resonance or Chrono Synchronization
**When** it loads
**Then** a numbered migration grants the matching new Legacy nodes, nothing the player bought is lost, and neither old node remains buyable (owner decision 2026-11-21: grant, not refund). Today neither node has an ownership flag: ownership is read from `state.offlineEfficiency` (0.75 = Temporal Resonance, 1.0 = both). Temporal Resonance → the Legacy efficiency node (+25 points, so the save keeps 75% without the research); Chrono Synchronization → the first Legacy cap-raise node, and the current run's offline-efficiency research is marked complete so the save stays at 100% until its next prestige
**And** efficiency is computed as 50% plus 25 points for the run research plus 25 points for the Legacy node, so the research and the Legacy node can be bought in either order
**And** efficiency is never above 100% and the cap never above 24 h

**Covers:** FR21

### Story 2.9: The return summary always offers a next move

> **Changed 2026-11-22 (PR #439, owner after the playtest):** the summary reports only what happened while away and has no next-action button (`getReturnMove` removed). The "never empty" property now applies to the game state, not the summary: every resumed state offers at least one allocation change or affordable upgrade. The criteria below are kept as built, with the next-move parts struck by this note.

As a player checking in,
I want to see what happened while I was away and one useful thing to do,
So that every return starts with a decision.

**Acceptance Criteria:**

**Given** a resume of 60 s or more
**When** catch-up completes
**Then** the offline summary sheet opens first, focused on open, reading `YOU WERE GONE <time>. THE NEST KEPT WORKING.`, with the efficiency %, gains and losses with glyphs built from the before/after states, warn lines such as `UPKEEP OUTRAN FOOD FOR 20M.`, and `THE NEST STOPPED GROWING AFTER <cap>.` (reading the live cap) when the cap was reached
**And** it has one next-action button from `getNextAction` that opens the relevant tab with the target highlighted

**Given** any resumed state
**When** the summary is built
**Then** it names at least one available allocation change or affordable upgrade, or `NEXT AFFORDABLE: <item> IN ~<time>` (property test over random states: never empty)

**Given** a resume under 60 s
**When** the game returns
**Then** no sheet opens and the strip deltas flash once

**Covers:** FR23, FR27, UX-DR24, UX-DR43 · NFR13

### Story 2.10: Pause lasts only while I'm watching

As a player stepping away from a desktop tab,
I want to pause the colony,
So that nothing happens until I'm back, without pause becoming an exploit.

**Acceptance Criteria:**

**Given** PAUSE in settings or the P key
**When** it is used
**Then** the ticker stops, the `PAUSED` overlay line shows, and the next tap or key resumes

**Given** a paused game
**When** the page is hidden or closed
**Then** the pause ends; on return the time away is normal offline time (Story 2.3 applies, including the summary after 60 s)
**And** no `paused` field exists in the save, and the game always reopens unpaused

**Covers:** FR25, UX-DR33 (paused)

### Story 2.11: Export and import my save

As a player,
I want to keep a copy of my save and restore it,
So that my run survives a browser wipe or a new phone.

**Acceptance Criteria:**

**Given** settings
**When** the player exports
**Then** they get a file containing the save (not the settings or intro flag)

**Given** an import
**When** the file isn't a valid swarm save
**Then** `THAT FILE ISN'T A SWARM SAVE.` shows and nothing changes
**And** when it is valid, a confirm sheet states that it replaces the current run and needs `HoldToConfirm`; the imported save is migrated to the current version before it loads

**Covers:** AR6 (export/import), UX-DR32 (export/import), UX-DR33 (import)

### Story 2.12: The browser keeps my save

As a mobile player,
I want the browser not to delete my run after a week away,
So that Safari's storage limits never end a run.

**Acceptance Criteria:**

**Given** the first meaningful play (for example, reaching Colony)
**When** it happens
**Then** the game calls `navigator.storage.persist()` once where supported, and logs the result

**Given** a mobile browser that is not running the installed app
**When** the player reaches the same point
**Then** a one-time hint explains adding the game to the home screen (home-screen web apps are exempt from Safari's 7-day storage cap), remembered outside the save

**Covers:** AR6 (durability)

### Story 2.13: The game installs and plays offline

As a player on a train,
I want the game to open with no connection,
So that playing never needs the network.

**Acceptance Criteria:**

**Given** vite-plugin-pwa (≥ 1.3, checked against Vite 8 with Context7) configured in `vite.config.ts`
**When** the site is built
**Then** it has a manifest with `display: "standalone"` and portrait orientation, and a service worker that precaches every asset
**And** a Playwright test loads the game once, goes offline and reloads, and the game plays

**Given** a new version deployed while a session is open
**When** the service worker sees it
**Then** it activates on the next cold start and never reloads the page mid-session

**Covers:** AR13 · NFR6, NFR10

### Story 2.14: Notifications have a seam but no web implementation

As the owner,
I want a place for a future store build's notifications,
So that adding them later needs no rework, while the web build never depends on them.

**Acceptance Criteria:**

**Given** a `Notifications` interface in `src/platform/` (schedule and cancel at predicted times)
**When** the web build runs
**Then** it uses a no-op implementation, never requests notification permission, and shows no notifications toggle
**And** no game layer imports it, and a test asserts that no game outcome changes whether the service is present or not

**Covers:** FR26, AR12 (notifications)

## Epic 3: Phases 1–3 pace right and never soft-lock

Phases 1–3 are reproducible, integer-clean and tuned against the GDD targets, and a CI test proves every guard is reachable.

### Story 3.1: Randomness is seeded and saved

As a developer reproducing a reported bug,
I want every random outcome to come from a seed stored in the save,
So that the same save and seed replay the same battles and events.

**Acceptance Criteria:**

**Given** `src/utils/rng.ts` (a small 32-bit seeded generator) and its state in `GameState`, added by a numbered migration that seeds existing saves
**When** a system needs randomness (battles, enemy scaling, decision timing, expedition and exploration outcomes, map generation)
**Then** it takes the generator state through the tick context and returns the advanced state; no `Math.random` remains in `src/systems/` or `src/sim/`, and the boundary test's known-exception list for it is empty
**And** two runs from the same state and seed produce identical states (unit test), while UI-only effects may still use `Math.random`

**Given** combat tests
**When** they run
**Then** they pass a fixed seed and still assert outcome sets (`victory | defeat | draw`), never one specific outcome

**Covers:** AR9 · ADR 0005

### Story 3.2: Balance lives in data files, in milliseconds

As a designer tuning pacing,
I want every number in typed data files with explicit units,
So that tuning never means hunting through system code or guessing what a "tick" is.

**Acceptance Criteria:**

**Given** `src/data/constants.ts` and one `src/data/balance/<system>.ts` per system, each an `as const` object
**When** this story lands
**Then** costs, rates, timers and caps for Phases 1–3 (hatch, mature and train times, role yields, upkeep, scale penalty, building costs and soft cap, Click Power, enemy scaling, decision timing) are read from these files, durations are named `…Ms` and rates `…PerSec`, and no balance value is expressed in ticks
**And** each converted duration keeps today's real-time behavior at 20 Hz (for example, a 50-tick hatch becomes 2 500 ms), with the conversion noted in the file, so this story changes no pacing

**Given** the unit tests
**When** they need a balance number
**Then** they import it from `data/balance/`; phase-guard targets stay only in `transitions.ts`; the boundary test fails on balance literals in `systems/`

**Covers:** FR40 (time units), AR19, AR20 (units) · FR5, FR6 (moved to data)

### Story 3.3: Every resource and cost is a whole number

As a player,
I want every count to be a whole ant, a whole seed, a whole crystal,
So that the colony stays physical.

**Acceptance Criteria:**

**Given** a property test that runs random seeded states through random ticks, actions and catch-ups
**When** it checks the state after each step
**Then** every value in `state.resources` satisfies `Number.isInteger` and is ≥ 0

**Given** every cost table in `data/balance/`
**When** a test scans them
**Then** every cost is a non-negative integer; `darkMatterDetection: { antimatter: 0.1 }` becomes an integer cost
**And** entropy is treated as a 0–100 meter outside `state.resources`, shown rounded, never spent

**Covers:** FR34, AR20 (integer property test)

### Story 3.4: Workers gather wood, forage nectar and dig stone

As a Colony player,
I want my workers to produce wood, stone and nectar,
So that buildings are buyable long before I find territory.

**Acceptance Criteria:**

**Given** a new Forage role and new yields for Gather and Dig in `data/balance/roles.ts`
**When** workers are assigned in Phase 2
**Then** Gather produces food and wood, Forage produces nectar, and Dig raises nest capacity and produces stone; each yield is floored when credited
**And** a unit test shows wood, stone and nectar each increase in Phase 2 from worker roles alone, with no territory

**Given** an existing save
**When** it loads
**Then** a numbered migration adds `forage: 0` to the assigned roles; the WRKR tab shows the Forage row automatically (from the role data)
**And** territory still adds to wood, stone and nectar from Phase 4

**Covers:** FR3, FR36

### Story 3.5: Buildings unlock in Colony

As a Colony player,
I want to build Barracks, Walls and Warehouse in Phase 2,
So that Colony has upgrades to spend on.

**Acceptance Criteria:**

**Given** the tab registry and phase content
**When** the player is in Colony
**Then** Barracks, Walls and Warehouse are listed and buyable in BUILD, and Silk Weaving, Chitin Armory and Venom Lab appear from Combat
**And** building costs stay `floor(base × growth^level)` with the soft cap above Lv.5 (values from `data/balance/buildings.ts`)

**Given** each building available in a phase
**When** a test checks its cost
**Then** every resource in the cost has a producer unlocked in that phase or earlier

**Covers:** FR7

### Story 3.6: No feature consumes a resource the player can't yet produce

As a player,
I want everything I can unlock to be payable,
So that I never meet a cost I have no way to meet.

**Acceptance Criteria:**

**Given** the content tables (buildings, research, mutations, equipment, ships, Legacy nodes) and a producer table (resource → earliest phase it can be produced)
**When** the catch-22 test runs
**Then** it fails if any feature's cost includes a resource whose earliest producer unlocks after that feature
**And** the scout-ship bootstrap through the 10% expedition space drops counts as a producer for void crystals

**Covers:** FR37

### Story 3.7: A headless simulated player

As a designer,
I want to run the real game with no browser,
So that pacing and soft-locks can be measured automatically.

**Acceptance Criteria:**

**Given** `src/sim/` with `SimRunner`, `CheckInSchedule`, `PlayerPolicy` and `Probes`
**When** a run starts from a seed and an initial state
**Then** it advances time only through `resume(elapsedMs)` and applies moves only through `actions/`, with no DOM, no sim-only shortcuts and no mocked systems (boundary test: `sim/` imports no `ui/`, `platform/` or DOM)
**And** the default policy follows `getNextAction`, rebalances roles and taps CONTINUE when the goal is met; it also performs the goal verbs that are not purchases, through the same actions a player uses: in Egg Laying it lays eggs during each check-in (tapping is the only egg source before automation), it assigns a GUARD when a goal condition needs one, and in Combat it trains soldiers and fights; decision events do not fire

**Given** the probes
**When** a run ends
**Then** they report the time each phase was entered, the number of actions per check-in and the decisions available per check-in

**Covers:** AR15 (runner, policy, probes)

### Story 3.8: CI proves every MVP phase goal is reachable

As the owner,
I want a test that fails when a phase can't be finished,
So that no balance change ever ships a soft-lock.

**Acceptance Criteria:**

**Given** `tests/sim/reachability.test.ts`
**When** it runs in `pnpm test`
**Then** for each of Egg Laying, Colony and Combat, starting at that phase's entry state, the guard is met within a generous ceiling (for example 10× the GDD target, set in the test file, not the target itself) without prestige
**And** it uses a fixed seed, asserts `reached === true` and `prestiged === false`, and fails if the run stalls (no progress in any guard condition across a full simulated day)

**Covers:** FR33 (soft-lock), FR39 · NFR12

### Story 3.9: A pacing report against the GDD targets

As a designer,
I want a table of simulated phase durations next to the targets,
So that I can see what to tune without putting balance numbers in tests.

**Acceptance Criteria:**

**Given** `pnpm sim`
**When** it runs (outside CI)
**Then** it prints, per MVP phase, the active-play time and the real-time duration for a player checking in about 6 times a day, next to the GDD targets (Phase 1: 3–5 min active; Phase 2: 20–40 min active, within day 1; Phase 3: days 2–3)
**And** it also reports the share of eggs from tapping in the first 2 min and after Colony, the median actions per check-in, and every check-in where nothing was affordable within about 4 h (a pacing defect)

**Covers:** AR15 (report), FR40 (measurement)

### Story 3.10: Play telemetry stays on the device

As a playtester,
I want my play to be measured locally and shared only when I choose,
So that the owner can tune pacing without the game calling home.

**Acceptance Criteria:**

**Given** a telemetry ring buffer outside the save
**When** the player plays
**Then** it records time per phase, check-in length and decisions available per check-in, with a fixed maximum size
**And** "export telemetry" in settings downloads it as a file; the game makes no network request (Playwright asserts no outgoing requests during play)

**Covers:** FR38 · NFR10

### Story 3.11: Tune Phases 1–3 to the target curve

> **Superseded targets (2026-11-23):** the first-week session shape and gates replace this story's targets; Story 9.9 and batch 2 re-tune against them.

As a mobile player,
I want Phase 1 in a few minutes, Colony within my first day and Combat over the next two,
So that the first days feel like steady discovery.

**Acceptance Criteria:**

**Given** the pacing report from Story 3.9
**When** balance values in `data/balance/` are tuned (and phase-guard targets in `transitions.ts` if needed)
**Then** the report's simulated durations fall within the GDD's Phase 1–3 targets, and no check-in in the run leaves the next affordable item more than about 4 h away
**And** upkeep, starvation and capacity still bite: the report shows at least one food-critical and one capacity-critical moment in Phase 2

**Given** the changes
**When** CI runs
**Then** the reachability test still passes, no test hard-codes a tuned number, and the story file records the before and after report
**And** the agent tunes autonomously: if a target can't be met by balance values alone, it gets as close as it can, keeps every invariant green, and explains the remaining gap in the PR description

**Covers:** FR40 (tuning) · FR4, FR5, FR6 (tuned)

## Epic 4: Every MVP phase is worth playing

Phases 1–3 each meet the depth bar, and Combat meets the combat interest bar.

### Story 4.1: Enemies show a trait before the fight

As a Combat player,
I want to see what I'm about to fight and what it's strong against,
So that preparing for a battle is a decision, not a gamble.

**Acceptance Criteria:**

**Given** `data/content/enemies.ts` listing enemy types (today's `red_ant`, `termite`, `spider`, `beetle`, `wasp`, `scorpion` as the starting set), each with a trait such as thick shell, swarm or venom resistance, and the stats that trait affects
**When** the next enemy is created with the seeded generator
**Then** at least 3 types can appear in Phase 3, and the enemy card shows its type and trait before the player commits (`ARMORED BEETLE · THICK SHELL`)
**And** enemy strength still scales sub-linearly with battles won (exponent in `data/balance/combat.ts`)

**Given** the combat simulation over a fixed set of builds (soldier count, equipment levels, mutations)
**When** each build fights each Phase 3 enemy type with a fixed seed set
**Then** no single build has the best win rate against every type (test asserts this relation, not specific rates)

**Covers:** FR12 (types and traits), UX-DR26 (trait on the card)

### Story 4.2: Equipment and mutations counter traits

As a Combat player,
I want each upgrade to answer some enemies better than others,
So that what I buy depends on what I face.

**Acceptance Criteria:**

**Given** weapons and armor (Lv.1–5) and the 6 mutations
**When** their effects are defined in `data/balance/combat.ts`
**Then** each one is marked as strong against at least one trait and gives no bonus, or a weaker one, against at least one other
**And** a pure `counterFor(cause)` returns the cheapest owned-or-buyable counter card for a battle cause, for the battle summary to use

**Given** Phase 3's currencies (food, silk, chitin, venom)
**When** a test lists Phase 3 purchases by currency
**Then** each combat-drop currency has at least two purchases competing for it

**Covers:** FR9, FR10, FR12 (counterplay)

### Story 4.3: Every battle explains its result

As a player who just lost a fight,
I want one line telling me why,
So that I know what to change before the rematch.

**Acceptance Criteria:**

**Given** `BattleSystem` resolving a battle
**When** it ends
**Then** the outcome is `victory`, `defeat` or `draw` (today's max-rounds case, where the enemy flees, becomes an explicit draw), with a typed `BattleCause` (for example `trait_beat_mutation`, `outnumbered`, `equipment_gap`), emitted as `battle_completed`
**And** silk, chitin and venom drop only on victory (asserted)

**Given** a completed battle
**When** the battle summary sheet opens
**Then** it shows VICTORY, DEFEAT or `DRAW · THEY RETREATED.`, losses, drops and one cause line in the colony's voice (`THEIR SHELLS TURNED YOUR VENOM.`), and `> CHANGE → <card>` opens the card `counterFor(cause)` returns (Story 4.2)
**And** when that card is unaffordable it shows its shortfall, and a cheaper counter is suggested if one exists

**Covers:** FR8 (draw), FR11, FR12 (summary), UX-DR25

### Story 4.4: A bigger army has a real cost

As a Combat player,
I want every soldier to cost the colony something ongoing,
So that "train the maximum and wait" is not always the best play.

**Acceptance Criteria:**

**Given** combat soldiers
**When** they exist
**Then** each costs a worker to train and food upkeep while alive (values in `data/balance/combat.ts`), shown on the WAR segment next to the soldier count
**And** a starving colony trains no new soldiers

**Given** the pacing harness
**When** the max-army policy and the default policy both play Combat from the same seed
**Then** the report shows at least one point where the max-army colony is food-critical while the default is not; the reachability test still passes for both
**And** (restated by Story 9.15, owner decision 2026-11-24, #478) once food has a limit, the target is relative: the max-army colony spends more Combat check-ins food-critical than the default one

**Covers:** FR12 (army trade-off)

### Story 4.5: Three decision events for each MVP phase

As a player,
I want events that fit the phase I'm in,
So that each phase brings its own dilemmas.

**Acceptance Criteria:**

**Given** `data/content/decisions.ts`
**When** a test groups events by phase
**Then** Egg Laying, Colony and Combat each have at least 3 events unique to that phase, each with 2 choices whose cost or risk is visible on the sheet
**And** every event has an ignore policy: across the MVP set there is at least one free, one costly and one unavoidable event (Beetle Sighting costly; `OVERCROWDING.` unavoidable, as in EXPERIENCE Flow 4)

**Given** any event's choices and ignore outcome
**When** `applyChoice` runs on random states
**Then** resources stay integers ≥ 0, workers never go negative, and no outcome wipes the colony

**Given** that this story needs new content
**When** the agent writes it
**Then** each addition serves at least one pillar (P1–P4), follows the colony voice (UX-DR42: upper case, present tense, no exclamation marks), names nothing from a later phase, and keeps every resource producible before it is consumed (Story 3.6)
**And** the PR description lists every addition with the pillar it serves and why it isn't strictly dominated, and the reachability test (Story 3.8) still passes

**Covers:** FR13 (content), FR14

### Story 4.6: Egg Laying has choices worth making

As a new player,
I want more than one thing to buy in my first minutes,
So that Phase 1 teaches spending, not just tapping.

**Acceptance Criteria:**

**Given** Phase 1's purchasables (Click Power plus the additions this story makes)
**When** a test lists them
**Then** there are at least 4, competing for Phase 1's currencies, and none is strictly dominant (no item costs the same or less and gives at least as much on every effect as another)
**And** Click Power remains the only tap upgrade; the additions improve hatching, upkeep or capacity, and appear in Phase 1's critical-path table

**Given** that this story needs new content
**When** the agent writes it
**Then** each addition serves at least one pillar (P1–P4), follows the colony voice (UX-DR42: upper case, present tense, no exclamation marks), names nothing from a later phase, and keeps every resource producible before it is consumed (Story 3.6)
**And** the PR description lists every addition with the pillar it serves and why it isn't strictly dominated, and the reachability test (Story 3.8) still passes

**Covers:** FR19 (Phase 1 upgrades)

### Story 4.7: Colony has choices worth making

As a Colony player,
I want several buildings and research projects pulling on the same resources,
So that how I spend shapes my colony.

**Acceptance Criteria:**

**Given** Phase 2's buildings and research
**When** a test lists them by currency
**Then** there are at least 4 purchasables competing for Phase 2's currencies, at least two of which compete for the same currency, and none is strictly dominant
**And** Phase 2's critical-path table lists them in the order the next-action rule should prefer

**Given** that this story needs new content
**When** the agent writes it
**Then** each addition serves at least one pillar (P1–P4), follows the colony voice (UX-DR42: upper case, present tense, no exclamation marks), names nothing from a later phase, and keeps every resource producible before it is consumed (Story 3.6)
**And** the PR description lists every addition with the pillar it serves and why it isn't strictly dominated, and the reachability test (Story 3.8) still passes

**Covers:** FR19 (Phase 2 upgrades)

### Story 4.8: Combat has choices worth making

As a Combat player,
I want equipment, mutations and combat buildings to compete,
So that there is no single build to copy.

**Acceptance Criteria:**

**Given** Phase 3's equipment, mutations and combat buildings
**When** a test lists them
**Then** there are at least 4 purchasables competing for Phase 3's currencies, none strictly dominant
**And** Phase 3's critical-path table lists them, and the combat-build test from Story 4.1 still finds no build best against every enemy type

**Given** that this story needs new content
**When** the agent writes it
**Then** each addition serves at least one pillar (P1–P4), follows the colony voice (UX-DR42: upper case, present tense, no exclamation marks), names nothing from a later phase, and keeps every resource producible before it is consumed (Story 3.6)
**And** the PR description lists every addition with the pillar it serves and why it isn't strictly dominated, and the reachability test (Story 3.8) still passes

**Covers:** FR19 (Phase 3 upgrades)

### Story 4.9: Each phase has a story beat on entry and near its goal

As a player,
I want a short line when a phase begins and when its goal is in sight,
So that the colony's story moves with my progress.

**Acceptance Criteria:**

**Given** `data/content/narrative.ts` with an entry beat and a near-goal beat for each MVP phase, in the colony's voice (`THE FIRST WORKER STIRS.`)
**When** a phase is committed
**Then** its entry beat types in during the reveal and is written to the log
**And** when the goal progress first passes a threshold (in `data/balance/`), the near-goal beat is written once per run, recorded in the save so it never repeats after a reload

**Given** that this story needs new content
**When** the agent writes it
**Then** each addition serves at least one pillar (P1–P4), follows the colony voice (UX-DR42: upper case, present tense, no exclamation marks), names nothing from a later phase, and keeps every resource producible before it is consumed (Story 3.6)
**And** the PR description lists every addition with the pillar it serves and why it isn't strictly dominated, and the reachability test (Story 3.8) still passes

**Covers:** FR19 (narrative beats)

### Story 4.10: Automation takes over verbs I've already learned

As a player,
I want to hand a repeated job to the colony once I've done it myself,
So that allocation stays the skill and tapping doesn't.

**Acceptance Criteria:**

**Given** each automatable verb the player performs by hand (egg laying, soldier training, recruitment; hatching has no manual action, and the automation research Basic Incubation, Queen's Pheromones and Thermal Regulation already add an automatic egg-laying rate in the code today, so "hatching" automation means egg laying)
**When** the player has performed it manually N times (N in `data/balance/`, starting at 10) or has reached the following phase
**Then** an automation target row appears under that verb: `KEEP [−] N [+] IN TRAINING` with an `[AUTO]` toggle (inverse when on)

**Given** automation on with a target
**When** the game runs, in the foreground or offline
**Then** the colony works toward the target and shows `holding at N`, or a `warn` reason (`food short`, `no free workers`) when it can't, and never spends past the target
**And** the manual-performance count is saved (numbered migration), and automation never answers decision events

**Given** that this story needs new content
**When** the agent writes it
**Then** each addition serves at least one pillar (P1–P4), follows the colony voice (UX-DR42: upper case, present tense, no exclamation marks), names nothing from a later phase, and keeps every resource producible before it is consumed (Story 3.6)
**And** the PR description lists every addition with the pillar it serves and why it isn't strictly dominated, and the reachability test (Story 3.8) still passes

**Covers:** FR16, UX-DR16

### Story 4.11: Each MVP phase passes the depth bar

As the owner,
I want a test that checks the depth bar for Phases 1–3,
So that "the phase is complete" is a fact, not a feeling.

**Acceptance Criteria:**

**Given** the content tables
**When** `tests/unit/depthBar.test.ts` runs
**Then** for each of Egg Laying, Colony and Combat it asserts at least 3 unique decision events, at least 4 competing purchasables with none strictly dominant, an entry beat and a near-goal beat, and a goal readout with one condition row per guard condition
**And** for Combat it also asserts at least 3 enemy types with traits, a battle cause for every outcome, and that soldiers cost food upkeep

**Covers:** FR19 (verification), FR12 (verification), FR14

## Epic 5: Prestige gives every run a clean start

Prestige wipes the run except LP, Legacy upgrades, lifetime stats and the victory record (#192), and old saves migrate.

### Story 5.1: The prestige condition is data and shows what's missing

As a player nearing prestige,
I want to see which requirements are still unmet,
So that I can plan for it.

**Acceptance Criteria:**

**Given** the prestige unlock check (already in `PrestigeSystem.isPrestigeAvailable`: Barracks, Walls and Warehouse at Lv.5; lifetime food, wood, stone and nectar thresholds)
**When** this story lands
**Then** the levels and thresholds come from `data/balance/prestige.ts`, and `isPrestigeAvailable` and `getUnmetRequirements` read them, so the two can never disagree (a property test asserts `isPrestigeAvailable(s) === (getUnmetRequirements(s).length === 0)`)
**And** the LOG → LEGACY section appears exactly when the condition is first met, stays once revealed, and lists unmet requirements in the colony's voice

**Covers:** FR28

### Story 5.2: Spending Legacy Points never lowers my production bonus

As a player who prestiged,
I want my production bonus based on all the LP I've ever earned,
So that buying Legacy upgrades never makes me weaker.

**Acceptance Criteria:**

**Given** `state.prestige.lifetimeLpEarned`, added by a numbered migration that initializes it to LP held plus LP already spent on Legacy upgrades
**When** a prestige awards LP
**Then** `lifetimeLpEarned` rises by the award, and LP is still computed as `floor(log10(totalFoodProduced) × phaseScore / 10)` plus the entropy bonus, with constants in `data/balance/prestige.ts`
**And** `productionMultiplier` uses `lifetimeLpEarned` (+15% per LP) instead of LP currently held

**Given** any Legacy purchase
**When** it spends LP
**Then** the production multiplier is unchanged (property test over random states and purchases)

**Covers:** FR29

### Story 5.3: Prestige wipes the run

As a player starting a new run,
I want every run to start clean,
So that each run revisits every phase and faster replays come from Legacy upgrades I can see.

**Acceptance Criteria:**

**Given** a state where prestige is available
**When** the player prestiges (through `HoldToConfirm`)
**Then** every resource, including void crystals, antimatter, dark matter and survey data, plus buildings, research (including the offline-efficiency research), mutations, equipment, territory, expeditions, ships, explorations, the goal latch and any open decision event are reset to their initial values, except what owned Legacy upgrades grant (starting resources, Phase Skip)
**And** LP, `lifetimeLpEarned`, purchased Legacy upgrades (including the offline-efficiency and cap upgrades), lifetime statistics and the victory record are unchanged (property test over random pre-prestige states)

**Given** the new run
**When** it starts
**Then** the phase is Egg Laying, or Colony when Phase Skip is owned (as today; Story 5.6 later restricts it), and the log reads `A QUEEN, AGAIN.` with no title cinematic; settings are untouched

**Covers:** FR30 (wipe)

### Story 5.4: Saves that carried space resources across prestige migrate

As a player with a save from before the rework,
I want my current run to follow the new prestige rules,
So that leftover space resources don't let me skip Space's decisions.

**Acceptance Criteria:**

**Given** a save from before this story, with at least one prestige and a current phase before Space
**When** it loads
**Then** a numbered migration sets void crystals, antimatter, dark matter and survey data to 0, because in a run that hasn't reached Space they can only have been carried over
**And** a save whose current run is in Space or Transcendence, or that has never prestiged, keeps its space resources unchanged

**Given** fixtures for both cases in `tests/saves/`
**When** the migration test runs
**Then** both migrate and load, and LP, Legacy upgrades, lifetime stats and the victory record are unchanged

**Covers:** FR30 (migration)

### Story 5.5: The victory record is a record, not a reward

As a player who has won,
I want my victory kept forever,
So that I can see it without it changing how my next run plays.

**Acceptance Criteria:**

**Given** `victoryAchieved` (kept across prestige, as today)
**When** any system runs
**Then** no system, guard, cost or unlock reads it (boundary test: only `ui/` selectors and the save reference it)
**And** two states identical except for `victoryAchieved` produce identical states after any sequence of ticks and actions (property test)

**Given** LOG
**When** the victory is recorded
**Then** the lifetime stats show it as a permanent entry

**Covers:** FR31

### Story 5.6: Phase Skip never skips a phase I haven't completed

As a player buying Phase Skip,
I want it to skip only phases I've already played through,
So that every phase is played at least once.

**Acceptance Criteria:**

**Given** `lifetime.phasesCompleted`, added by a numbered migration that derives it from the save's recorded history (each prestige implies the phases its requirements need; missing information means "not completed")
**When** `commit` moves the run out of a phase
**Then** that phase is added to `phasesCompleted`, which survives prestige

**Given** Phase Skip owned
**When** a new run starts
**Then** the start phase is never later than the first phase not in `phasesCompleted` (property test over random histories)

**Covers:** FR32

## Epic 6: Phases 4–5 on mobile, with depth (post-MVP, placeholder)

Expansion and Space are playable one-handed in portrait and meet the depth bar. Covers FR48, FR49, FR50, FR53 and UX-DR44, UX-DR45. Stories are written after the MVP playtest (GDD sequence: E5 → MVP playtest → E6), using `gds-correct-course` if the playtest changes the plan. Until then, the Phase 4–5 legacy panels stay hosted in FRONT → MAP and STARS (Story 1.25).

## Epic 7: Transcendence and the ending (post-MVP, placeholder)

The first run ends in a real victory that offers prestige. Covers FR33 (win), FR51, FR52 and UX-DR46. Stories are written after Epic 6.

## Epic 8: Each phase looks and sounds like itself

Phases 1–3 each have their own palette, glyphs, sounds and a living countable-ant nest. The full nest scene is MVP (owner decision, 2026-11-21).

### Story 8.1: The game ships its own monospace font

As a player on any phone,
I want the terminal grid to line up the same everywhere,
So that meters, boxes and symbols never break.

**Acceptance Criteria:**

**Given** "Swarm Mono", a subset of an OFL monospace font (for example JetBrains Mono or IBM Plex Mono), shipped as WOFF2 in regular and bold with its licence file
**When** a test reads the font files
**Then** both weights cover ASCII, box-drawing, block elements and `· − × ✓ ✗ ▲ ▼ • █ ░ ▒ ▓`, every one of those characters has the same advance width, and the two files total well under 50 KB
**And** system monospace is only the fallback in the font stack

**Given** the 6 type roles (display 24, title 20, value 15, body 14, aside 13, meta 12)
**When** styles are checked
**Then** sizes are in rem, no text is below 12 px, no sentence-case text is below 13 px, and text glow is only applied at 15 px and above

**Covers:** UX-DR2

### Story 8.2: Twenty line glyphs replace every emoji

As a player,
I want small, clear icons that match the terminal,
So that resources are recognizable at a glance in every phase color.

**Acceptance Criteria:**

**Given** `ui/glyphs/` with 20 TSX SVG glyphs (14 resources, 6 buildings) plus a gear, named `Glyph<Name>`
**When** they render
**Then** each uses a 24×24 grid, a 1.6 px round-capped stroke and `currentColor`, and is decorative (`aria-hidden`) next to a text label
**And** VNOM is drawn as a fang or vial, so it can't be mistaken for FOOD

**Given** every file in `src/`
**When** a test scans them
**Then** no emoji code point appears anywhere, placeholders included

**Covers:** FR43 (icons), UX-DR35 · NFR11

### Story 8.3: Every screen uses only the phase palette

As a player entering a new phase,
I want the whole interface to repaint in the new color at once,
So that the reveal is the reward.

**Acceptance Criteria:**

**Given** the Phase 1–3 palettes from Story 1.8
**When** a test renders each tab and sheet in each MVP phase
**Then** every computed color on the page resolves to that phase's tokens (or transparent), with no colors left over from legacy CSS
**And** committing a phase cross-fades the old palette to the new one over 3 s (300 ms under reduced motion), and the Combat reveal is the first time an enemy creature is drawn

**Covers:** FR43 (palettes)

### Story 8.4: CRT effects, off text by default

As a player,
I want the old-monitor glow without losing readability,
So that the look never costs me contrast.

**Acceptance Criteria:**

**Given** the CRT setting
**When** it is SCENE (default)
**Then** scanlines appear only over the vector scene and full-screen overlays, never over text, the strip, the tab bar or sheets; vector line-work gets a 3 px accent glow; accent text of 15 px and above gets a text-shadow of at most 2 px at no more than 35% opacity
**And** FULL adds scanlines everywhere and the setting states that contrast is reduced; OFF removes scanlines and glow

**Given** the OS asking for more contrast or reduced transparency, or a text scale above 130%
**When** the game boots
**Then** CRT effects are OFF; scanlines are drawn in device pixels to avoid moiré

**Covers:** UX-DR36

### Story 8.5: The nest scene shows the colony as countable ants

As a player,
I want to see my colony as real ants in a nest cross-section,
So that every number is an ant I can see.

**Acceptance Criteria:**

**Given** `selectNestView` (updates at most 4 times a second), a pure `nestLayout(view)` and a `NestScene` SVG component in `ui/scenes/`
**When** NEST renders
**Then** the placeholder from Story 1.22 is replaced by soil (accent fill at 7%, grain, strata, pebbles, a grass line), round-capped tunnels, chambers, the queen, workers, eggs and larvae, drawn in the phase's accent
**And** `nestLayout` is deterministic for a given view (unit test), and the scene never reads `gameState` or writes anything (boundary test)

**Given** any colony
**When** the scene renders
**Then** exact integer counts sit in HTML chamber labels from selectors, never from counting drawn ants; the scene root is a group labelled with its counts ("Nest: 37 workers, 5 eggs, 4 larvae"); each chamber is a labelled button that opens a peek sheet with that chamber's counts

**Covers:** FR44, AR14 (selector → layout → SVG), UX-DR34 (scene, labels, chambers) · N1

### Story 8.6: The nest stays smooth with thousands of ants

As a player with a big colony on a cheap phone,
I want the nest to stay smooth,
So that growth never makes the game stutter.

**Acceptance Criteria:**

**Given** a chamber whose drawn ants would cover more than about 15% of its area (threshold in `data/balance/scene.ts`)
**When** it renders
**Then** the extras become one dot-cloud `<path>` (1–1.5 px dots at varying opacity), with 30–50 individual ants still moving on top, and never more than 50 individually animated ants in the whole scene (unit test on `nestLayout`)

**Given** `useSceneClock`, one rAF loop for all scenes
**When** the page is hidden, or reduced motion is on
**Then** the loop stops; otherwise it moves individual ants along tunnel paths without causing re-renders of the rest of the UI

**Given** `pnpm perf` on the reference phone with a colony of several thousand
**When** it measures scene frame times
**Then** it reports p95 frame time; if p95 exceeds 16 ms, the story file records the result and moves the dot cloud to Canvas 2D (measured, not asserted in CI)

**Covers:** AR14 (budget, fallback trigger) · NFR2

### Story 8.7: The nest grows, wanders and starves

> **Changed 2026-11-23:** the camera steps are replaced by a nest that shows only dug rooms (Story 9.6). Wandering and the starving colony stay.

As a player,
I want the nest to change as the colony changes,
So that I can read the colony's health at a glance.

**Acceptance Criteria:**

**Given** the colony size
**When** it crosses about 50 and about 150 workers (thresholds in `data/balance/scene.ts`)
**Then** the camera pulls back from 2× to 1.5× to 1×, easing over 1 s (instant under reduced motion), and an individually drawn worker is never smaller than 12 px

**Given** the game running
**When** time passes
**Then** ants wander gently between check-ins; a hatching egg becomes a larva and a new worker walks into a chamber; a starving colony visibly thins (fewer drawn ants) while the labels keep the exact count; none of this runs under reduced motion

**Covers:** UX-DR34 (camera, wandering, starving)

### Story 8.8: Sound effects, muted until I want them

As a player on a bus,
I want the game silent unless I turn sound on,
So that it never surprises the people around me.

**Acceptance Criteria:**

**Given** an `Audio` platform service wrapping the existing synthesized `AudioSystem`
**When** the game boots
**Then** sound is off by default; when on, it plays synthesized effects for tap (key click), hatch, battle result, phase transition and decision event (two-tone chime), with hatch limited to 1 per second and key clicks to 8 per second
**And** it creates no audio context before the first user gesture, uses Web Audio so the device's silent switch applies where the browser honours it, and is a no-op where audio is unavailable

**Given** any event that plays a sound
**When** sound is off
**Then** the same information is available visually (audio is never the only channel)

**Covers:** FR42, AR12 (audio)

### Story 8.9: Every important moment has its own feel

As a player,
I want taps, hatches, battles and reveals to feel distinct,
So that I notice what matters without reading every line.

**Acceptance Criteria:**

**Given** the game-feel table in EXPERIENCE.md (lay egg, hatch/mature, newly affordable, press/hold buy, battle result, decision event, phase change, camera pull-back)
**When** each trigger fires
**Then** its visual, haptic pattern and sound (when on) play as listed, for example lay egg: an egg appears by the queen, `+1` types in next to EGG, light haptic; battle result: the headline types in, medium haptic on a win and double light on a loss
**And** floating `+N` appears at most 8 times a second, haptics follow the haptics setting and are never the only feedback, and the flash rule (Story 1.11) still holds

**Covers:** UX-DR37 · FR41

### Story 8.10: The title cinematic on first launch

As a first-time player,
I want a short opening that sets the scene,
So that the queen's story starts before the first tap.

**Acceptance Criteria:**

**Given** no save and no intro flag (`the_swarm_intro_seen`, its own key)
**When** the game opens
**Then** a cinematic of about 11 s plays in Phase 1 amber only (the queen lands, tunnels down, the first chamber opens; `ONE EGG.` `ONE QUEEN.` `ONE SWARM.`), and the flag is set when it starts, so backgrounding mid-cinematic never replays it
**And** a tap, Enter, Space or Esc skips it, and it ends on a real `[ TAP TO WAKE THE QUEEN ]` button, then `A QUEEN, ALONE.`, the brood chamber and a coach mark on LAY EGG

**Given** reduced motion
**When** the cinematic would play
**Then** it opens on its final title frame

**Given** settings → replay intro, or E2E tests
**When** used
**Then** replay plays it again without touching the save, and `seedSave(page, state, { introSeen: true })` skips it in tests

**Covers:** UX-DR28

## Epic 9: The first week digs in

From the owner's mobile playtest (2026-11-22, `_bmad-output/playtest-2026-11-22.md`): the owner quit in Colony after a capacity wall of about 5 h, two minutes into play. Issues #436 and #438; brainstorm `_bmad-output/brainstorming-session-2026-11-22.md`; Correct Course `sprint-change-proposal-2026-11-23.md`. Mockups: https://claude.ai/artifact/Rs3RWvuwqrsbx7p5CWEsNp (their two-button row is superseded: DIG is the only main button, FEED is a tap on the brood in the scene).

Batch 1 (the DIG core, Stories 9.1–9.9, and the resource sheet, Stories 9.10–9.12 from #437) shipped on 2026-11-23. Batch 2 (space and food, Stories 9.13–9.18) is written below and builds in order. Batch 3 stories are written after batch 2 ships.

### Story 9.1: The simulated player plays the first week

As a designer,
I want `pnpm sim` to play the first week the way the GDD's session shape describes,
So that I can see whether the first-week gates pass before tuning anything.

**Acceptance Criteria:**

**Given** a `firstWeekSchedule(days)` in `src/sim/schedule.ts`, its shape read from `data/balance/sim.ts`
**When** it builds a run
**Then** session 1 is one continuous session (45–60 min), days 1–3 hold sessions of 5–15 min about 6 a day, days 4–7 shrink toward the steady state, and after day 7 each check-in is played until the policy has no useful move left (capped by a ceiling in the balance file), so the check-in length is measured, not given
**And** unit tests check the schedule's invariants (real-time order, session 1 continuous, sessions shorter after day 3 than before), never its numbers

**Given** the probes
**When** a run plays
**Then** they record payoffs: a room opened, an item newly affordable, a goal condition newly met, a phase entered; an **idle gap** is a stretch of play with no payoff
**And** they record each check-in's length and the decisions available in it (existing probe)

**Given** `pnpm sim` (default: the first-week schedule, a fresh game, 10 days)
**When** it prints the report
**Then** the report shows the three gates (GDD *Success Metrics*) as pass or fail next to their targets: (1) the longest idle gap in the first 30 min of continuous play, against 2 min; (2) the day Phase 3 ended, against about day 7; (3) after day 7, the median check-in length against 90–120 s and the share of check-ins with at least one decision, against 100%
**And** the phase targets in `data/balance/pacing.ts` follow the new *Difficulty Curve* (Phase 1 in the first minutes of session 1; Colony ends on day 1 in a later session; Combat days 2–7)
**And** the gate verdicts are pure functions over probe data with unit tests on synthetic probes (a gap over the limit fails, one under passes); CI never asserts a gate on a real run

**Covers:** FR54 (schedule), FR65 (report) · AR15

### Story 9.2: DIG digs the next room

As a player in Colony,
I want one big DIG button that digs the next room a chunk at a time,
So that I can make room for my colony now instead of waiting a day.

**Acceptance Criteria:**

**Given** the phase is Colony or later and no goal is latched
**When** NEST renders
**Then** its pinned primary action is `> DIG` (`[data-nest-primary=dig]`), replacing the next-action button NEST shows today (`[data-nest-primary=next]`; BUILD and WRKR keep theirs, and `NestPrimary` tests change to match); Phase 1 keeps `> LAY EGG`, and a latched goal still swaps the slot for `> CONTINUE`; Space presses DIG through the existing primary-action shortcut (Story 1.30)

**Given** a DIG press (a `dig` intent in `actions/`, returning `Result`)
**When** it applies
**Then** it adds one chunk to the current room's progress: a fixed base plus a share for each worker on the DIG role (values in `data/balance/`), and it adds stone for the dirt dug, as an integer
**And** when progress reaches the current room's cost, the room opens: nest capacity rises by the room's size (more than 1), progress carries over, the rooms-dug count rises, and the next room costs more presses than this one (property test: cost strictly increases with the rooms dug)
**And** hold-to-repeat works as on every primary action (UX-DR11)

**Given** diggers and no presses
**When** time passes, live or in catch-up
**Then** diggers dig on their own at a slow rate (Tunnels still speed them up), so a run that never presses DIG still opens rooms (sim test: no presses, at least one digger, a room opens within a generous ceiling); the result is the same for any step length (Story 2.5 property)

**Given** the change to the state
**When** a save from before this story loads
**Then** a numbered migration adds the dig state (rooms dug, progress) and never lowers the nest capacity the save had; resources stay integers

**Given** the simulated player
**When** it plays a check-in in Colony or later
**Then** it presses DIG at `simBalance.tapsPerSec` while a room is needed, through the same action a player uses
**And** the WRKR Dig role text describes the new rule (adds to every press, digs slowly alone), read from the balance, never restated

**Covers:** FR55, FR3 (Dig), FR5 · UX-DR11

### Story 9.3: NEXT ROOM shows how close the next room is

As a player,
I want to see how far the next room is and how long it will take,
So that digging never feels like an invisible timer.

**Acceptance Criteria:**

**Given** a pure selector `selectNextRoom` (progress share, presses left, the next room's size, time left at the diggers' own rate)
**When** NEST renders in Colony or later
**Then** a NEXT ROOM strip sits under the scene: `NEXT ROOM`, `+<size>`, a text meter, `IN <time>` and `· <n> DIGS`; with no diggers the time reads `NO DIGGERS` instead (Story 9.5 adds the auto-dig state to the selector and the strip)
**And** the meter is a `role="progressbar"` with an `aria-valuetext`, and the strip refreshes at most 4 times a second

**Given** the time left
**When** the strip shows it
**Then** it comes from the same rate the dig system uses (unit test: the selector's time matches the simulated time to open the room within one step)

**Given** the nest scene
**When** progress grows
**Then** a crack at the dig face grows in a few visible stages from the same selector (none of it animates under reduced motion)

**Covers:** FR56 · UX-DR47

### Story 9.4: FEED hurries larvae into a free room

As a player who just dug a room,
I want to tap the brood to hurry larvae into it,
So that a new room fills while I watch.

**Acceptance Criteria:**

**Given** the phase is Colony or later, larvae waiting and a free room (workers below capacity)
**When** the player taps the brood in the nest scene (the brood chamber's existing button, relabelled "Feed the brood" from Colony on)
**Then** a `feed` intent speeds the larva pipeline by a fixed amount from `data/balance/`; it costs nothing (owner, 2026-11-23), and it never matures more larvae than there are free rooms (property test)

**Given** no free room, or no larvae
**When** the brood control renders
**Then** it is disabled with its reason (`FEED · NEST FULL`, or no larvae), and DIG remains the move

**Given** the pipelines
**When** FEED applies
**Then** every larva that leaves the larva pipeline becomes a worker (the pipeline rule in CLAUDE.md); resources stay integers; one state write

**Given** the brood chamber's peek sheet (Story 8.5)
**When** the phase is Colony or later
**Then** tapping the brood feeds and no longer opens its peek: the egg and larva counts stay in the chamber label and the brood line (owner, 2026-11-23); the workers chamber keeps its peek, Phase 1 keeps the brood peek, and the `nest-tab` E2E spec is updated to match

**Covers:** FR57, FR2 · UX-DR34 (changed)

### Story 9.5: Auto-dig hands the digging to the diggers

As a player who has dug a few rooms by hand,
I want to buy auto-dig,
So that the diggers carry on without me once I know how it works.

**Acceptance Criteria:**

**Given** the player has opened a few rooms by hand (count in `data/balance/automation.ts`, following FR16's manual-count rule)
**When** BUILD renders
**Then** an auto-dig card appears, paid in stone (owner, 2026-11-23); stone comes from digging, so it is always producible first (Story 3.6 check passes)

**Given** auto-dig bought
**When** the game runs, in the foreground or offline
**Then** the diggers press DIG on their own at a rate from the balance (each press worth the usual chunk), `selectNextRoom` reports it and the NEXT ROOM strip reads `NEXT ROOM · AUTO-DIG ON` with the time at the auto-dig rate, and NEST's primary action becomes `> AUTO-DIG ON` with the hint `tap to boost the dig`; a press still adds a chunk
**And** the result is the same for any step length, and the purchase is saved (numbered migration if it adds a field)

**Given** that this story adds content
**When** the agent prices it
**Then** the price lands auto-dig around the end of day 1 in the Story 9.1 report, and the PR records the price and the reason (Story 9.9 may retune it)

**Covers:** FR58, FR16 (digging)

### Story 9.6: The nest shows only what I've dug

As a player on a phone,
I want the nest to show just the rooms I've dug,
So that a young nest fits my screen and grows as I dig.

**Acceptance Criteria:**

**Given** `selectNestView` with the rooms dug
**When** `nestLayout` lays out the scene
**Then** it draws only the queen's chamber, the brood and the rooms dug so far, surrounded by solid soil, and frames them so the whole dug nest fits the scene area at every phone width from 320 px without cropping a chamber (unit test on `nestLayout` over a range of room counts)
**And** it replaces the camera steps (`sceneBalance.cameraSteps` and the 2× crop) and removes what only served them: the camera pull-back UI event (`ui/nest/cameraPullBack.ts`), its `camera-pull-back` game-feel trigger and `feelBalance.cameraPullBackMs`; the room opening below takes over that moment (Story 9.8 adds its sound and haptic); an individually drawn worker is still never under 12 px, and the dot cloud and the 50-ant cap still apply (Story 8.6)

**Given** a room opens
**When** the scene updates
**Then** a quick, light opening animation plays (dirt falls, the chamber outline appears), at most about 1 s, instant under reduced motion, within the flash rule

**Covers:** FR59, FR44 · UX-DR34 (changed) · AR14

### Story 9.7: The NEST tab fits the digging loop

As a player in Colony on a phone,
I want the NEST tab laid out around digging,
So that the goal, the next room, the brood and DIG fit on one screen.

**Acceptance Criteria:**

**Given** the phase is Colony or later on a 390×844 phone viewport (and the 360×512 minimum)
**When** NEST renders
**Then** from top to bottom it shows: the goal block condensed to at most 4 lines, the scene, the NEXT ROOM strip, the brood control on one line (`BROOD <n> EGGS · <n> LARVAE` with the laying target `KEEP [−] N [+] AUTO`), the event lines, and `> DIG` in the pinned primary zone with a hint line (`chunk +n · n stone · tap the brood to feed when a room is free`)
**And** nothing overlaps or scrolls sideways, the primary action stays in the bottom 40%, and every control is at least 44×44 px (Playwright, seeded with a Colony save that satisfies the real guards)

**Given** the existing `data-*` hooks on NEST
**When** the layout changes
**Then** they are kept, and new parts get hooks (`[data-next-room]`, `[data-brood-feed]`)

**Covers:** UX-DR48, UX-DR5 · NFR7, NFR9

### Story 9.8: Every dig press feels like moving earth

As a player,
I want each DIG press to crunch and each breakthrough to land,
So that twenty presses feel like digging, not like a chore.

**Acceptance Criteria:**

**Given** a DIG press
**When** it lands
**Then** within 100 ms the scene shows a dirt puff at the dig face and a small shake, and a crunch plays when sound is on (rate-limited like key clicks)
**And** under reduced motion there is no shake and no particles; the crack and the strip still move

**Given** a room breaking through
**When** it opens
**Then** a breakthrough sound plays (sound on) and the device vibrates through the `Haptics` service where `navigator.vibrate` works; where it does not (iPhone Safari), the sound and the shake carry it and nothing fails (owner, 2026-11-23)
**And** the flash rule holds during a 2 s DIG hold (the Story 1.11 test extended to DIG)

**Covers:** UX-DR49, UX-DR37, UX-DR38 · FR41

### Story 9.9: Tune the DIG core so session 1 never walls

As a new player,
I want my first half hour to always have something worth doing,
So that I'm still playing at minute 30 instead of quitting at minute 2.

**Acceptance Criteria:**

**Given** the Story 9.1 report
**When** the dig, feed, capacity and Warehouse values in `data/balance/` and the Phase 1–2 worker guards in `transitions.ts` are tuned
**Then** gate 1 passes (no idle gap over 2 min before 30 min of continuous play), Colony ends on day 1 in a session after the first, and the Phase 1–2 guards sit in the GDD's target ranges (about 10–20 and about 150–300 workers plus a guard)
**And** this includes the capacity rebalance from #438: the start capacity, the room size, the room cost growth and the Warehouse cost and rooms, so that a player who doesn't tap still reaches the Colony goal (reachability test)
**And** the worker targets stay in phase order: the Combat → Expansion (60 today) and Expansion → Space (80 today) worker conditions are raised so that each is above the one before it (property test over `transitions.ts`: worker targets strictly increase along the phase order); their final values come with batch 2

**Given** the changes
**When** CI runs
**Then** the reachability test (Story 3.8) passes for every MVP phase, no test hard-codes a tuned number, the E2E seeds still satisfy the real guards, and the story file records the before and after report
**And** the agent tunes autonomously: if a target can't be met by values alone, it gets as close as it can and explains the gap in the PR description

**Covers:** FR64 (Phase 1–2), FR65 (gate 1), FR54 (session 1) · FR5

### Story 9.10: The resource sheet reads on a phone

As a player holding my phone in one hand,
I want each resource on two short lines with only the numbers that mean something,
So that the sheet is readable at 390 px without squinting at five columns.

**Acceptance Criteria:**

**Given** the resource sheet (Story 1.16) on a 390×844 viewport and at the 360×512 minimum
**When** it opens
**Then** each resource takes two lines: glyph, full name and exact amount; then, in `dim`, its rate, its source and a text sparkline of the last 10 minutes (`▁▂▃▅`, from a fixed-size history outside the save)
**And** a cap shows only where one exists, as a fill meter (`████··· 74%`); no row shows `—`
**And** falling or capped resources come first, the rest in the phase's order; past about 8 rows (threshold in `data/balance/`) the rows group by tier (`COLONY`, `BATTLE DROPS`, `SPACE`), collapsed except a group holding a falling or capped resource
**And** nothing overlaps or scrolls sideways, and every row is reachable in the bottom 40% by scrolling (Playwright)

**Given** a rate whose magnitude is under 1 per second
**When** it is shown
**Then** it reads per minute as a whole number (`+36/M`), never `0` while it is not zero (unit test on the formatter: a non-zero rate never formats as zero); rates of 1/s or more read per second as today

**Given** a resource unlocked for the first time
**When** the sheet next opens
**Then** its row is marked `NEW` until the sheet closes, once per resource per run

**Given** a tap on a row
**When** it opens
**Then** a peek shows where the resource comes from and what spends it, read from the same data the systems use

**Covers:** FR66, UX-DR8 (changed), UX-DR4 · NFR7, NFR9

### Story 9.11: The resource sheet tells me if I'm okay

As a player with ten seconds,
I want the sheet to open with one line that says what's worst and how long I have,
So that I know whether to act before I read a single row.

**Acceptance Criteria:**

**Given** a pure `getVerdict(state)` (in `systems/`, no DOM)
**When** the sheet opens
**Then** its first line is the worst current state, first match wins, in an order kept in `data/content/`: food falling (`FOOD LASTS <t>`), nest full with larvae waiting (`NEST FULL · <n> LARVAE WAIT`), otherwise `EVERYTHING IS GROWING`; a falling verdict is `warn`
**And** the runway is computed from the current rates (unit test: the runway equals the time the simulation takes to empty the stock, within one step)

**Given** a tap on the verdict line
**When** it applies
**Then** it opens the screen that fixes it (WRKR with the Gather row highlighted for food; NEST for a full nest), only on that tap; nothing opens or highlights on its own

**Given** the sheet was opened before in this session
**When** it opens again
**Then** a `SINCE <time>` line shows the change in food and in the food net rate since then (`FOOD +1 204 SINCE 14:02 · NET WAS −3/S, NOW +2/S`); the first opening shows none

**Covers:** FR66, UX-DR50 · FR27 (decisions are offered, never pushed)

### Story 9.12: I can see where the food goes

As a player in Colony,
I want to see who brings food in, who eats it and what I spent it on,
So that I can fix a food problem without doing arithmetic.

**Acceptance Criteria:**

**Given** the phase is Colony or later
**When** the sheet opens
**Then** a food block sits under the verdict: `FOOD IN +n/S ← gatherers n · idle n`, `EATEN −n/S → workers n · soldiers n`, `SPENT THIS HOUR: <item> n · …` for one-off spends (Click Power, soldiers, buildings, research), and `ONE GATHERER FEEDS <n>.` derived from the balance, never restated
**And** the parts add up: `IN − EATEN` equals the net shown in WRKR (property test over random states), and Phase 1 shows no food block

**Given** a name in the food block
**When** the player taps it
**Then** it opens that role's row in WRKR, or WAR for soldiers

**Given** a control that adds an eater (a role `[+]` that adds a worker, the soldier train card)
**When** it renders
**Then** it shows what the new eater will eat (`+0.75/S EATEN`), from the balance

**Covers:** FR66, UX-DR51 · FR12 (army cost visible)

### Batch 2: space and food

One system: how many ants the nest and the stores can hold (GDD *Space and Food*). Written 2026-11-23 after batch 1
shipped (`sprint-change-proposal-2026-11-23-batch-2.md`, decisions #54–#63). Build order is space first, then food:
each room job arrives with the system it changes, so no story points at a later one.

Every story here changes balance, so each one names the `pnpm sim` gates it must keep and shows their verdicts
before and after in its PR (CLAUDE.md, retro 2026-11-23). Batch 1 left gate 1 passing; gates 2 and 3 pass in Story 9.18.

### Story 9.13: Crowding slows a nest packed past its rooms

As a player with a full brood and a growing army,
I want work to slow when I pack more ants in than the rooms hold,
So that digging more room matters at a thousand ants, not just at fifty.

**Acceptance Criteria:**

**Given** a pure `getCrowding(state)` in `systems/` (no DOM)
**When** it is computed
**Then** it counts every creature that takes up room: workers (researchers included), combat soldiers, scouts, warriors, eggs and larvae, never the queen; the room space is the effective nest capacity (rooms dug × room size + the starting chambers + the Warehouse)
**And** it returns a work multiplier: exactly 1 while the creatures fit the room space, then falling as the overfill share grows, never below `crowdingBalance.floor` (50% of normal work; values in `data/balance/`)
**And** property tests: the multiplier is in [floor, 1], is 1 at or under full, never rises when a creature is added, and never falls when room space is added

**Given** the multiplier
**When** the colony works, live or in catch-up
**Then** it replaces `workerEfficiency` where it is applied today (food and the Gather, Forage and Dig role yields in `ResourceSystem`, and `GameLoop.getWorkerEfficiency`) and also slows the diggers' own dig points (`systems/Dig.ts`, not slowed today); `workerEfficiency` and `progressionBalance.scalePenalty` are removed, and their tests are rewritten as crowding invariants
**And** a DIG press's own chunk is not slowed (tapping stays a boost, Pillar 3); the diggers' share of a press is
**And** upkeep is not reduced (crowding bites), and the Legacy worker-efficiency node still multiplies work as before
**And** the result is the same for any step length (Story 2.5 property), so macro-step catch-up matches live play

**Given** crowding bites (multiplier below 1)
**When** NEST renders
**Then** the NEXT ROOM strip adds `CROWDED · −<n>% WORK` in `warn` (n a whole percent from the same multiplier, UX-DR47), the scene draws the overfill as ants spilling into the tunnels (`nestLayout`), and WRKR's rates and the resource sheet show the slowed yields
**And** `OVERCROWDING.` (Story 4.5) spawns when crowding bites instead of from its own worker-share rule, so the two never disagree

**Given** the simulated player
**When** the pacing report runs
**Then** it prints the share of check-ins that start crowded, per phase
**And** gate 1 still passes (before and after verdicts in the PR)

**Covers:** FR60, FR6 (replaced) · UX-DR47

### Story 9.14: A new room can take a job

As a player who just opened a room,
I want to give it a job with one tap, or leave it plain,
So that every room I dig is a small choice about what my colony needs.

**Acceptance Criteria:**

**Given** the phase is Colony or later
**When** a room opens from a DIG press
**Then** a one-tap choice appears with the room-opened line: `GALLERY` (holds twice as many ants) or `PLAIN`; dismissing it or doing nothing leaves the room plain, and it never blocks DIG, FEED or CONTINUE (it is a peek in the SheetController's queue, never a modal)
**And** rooms opened by the diggers alone, by auto-dig or while away open plain, and NEST shows `<n> PLAIN ROOMS` with a way to assign them later

**Given** the room jobs
**When** the state stores them
**Then** they are counts by job (`roomJobs`, never more in total than the rooms dug); no ant has a location; a numbered save migration adds them at zero, and prestige resets them with the run
**And** each Gallery room adds the room size again to the nest capacity (and so to the room space crowding reads); property test: capacity never falls when a room gets a job, and a Gallery room adds exactly one more room's worth

**Given** a room with a job (or plain)
**When** the player changes it from NEST
**Then** a `setRoomJob` intent in `actions/` (returning `Result`) changes it for a stone cost from `data/balance/` (none for plain → job on a room never assigned); refusals explain themselves (not enough stone, the change would put workers over capacity)
**And** the job list is data (`data/content/` copy, `data/balance/` effects), so later stories add jobs without changing the choice UI

**Given** the simulated player
**When** a room opens
**Then** it picks a job through the same intent (Gallery when crowded, otherwise plain), and gate 1 still passes (before and after verdicts in the PR)

**Covers:** FR63 (Gallery), FR59

### Story 9.15: The food store has a limit

As a player who leaves gatherers working overnight,
I want the stores to fill up and stop,
So that food is something I manage, not a number that only goes up.

**Acceptance Criteria:**

**Given** a pure `getFoodLimit(state)` in `systems/`
**When** it is computed
**Then** it is a base for the starting chambers, plus a share for every room dug, plus much more for every Larder room (values in `data/balance/`); it never falls as rooms are dug
**And** the room-job choice (Story 9.14) gains `LARDER` (raises the food limit), as data

**Given** food income would take food past the limit
**When** a step applies, live or in catch-up
**Then** food stops at the limit and the rest is lost; the amount lost is counted for the run (`foodLostAtLimit`, a numbered save migration adds it); resources stay integers and the result is the same for any step length
**And** a save loaded with more food than the new limit keeps it: only new income past the limit is lost (no food disappears on load)
**And** no catch-22: every food cost the player can meet in a phase fits under the limit the colony can reach by that phase's guard (property test over the items in `data/balance/` and the limit at each guard)

**Given** the food store is at its limit
**When** the strip, the resource sheet or the return summary renders
**Then** the strip shows FOOD in its capped state, the sheet's runway reads `FULL IN <t>` while food is rising (computed from the current rates, same check as Story 9.11's runway), and the return summary says `FOOD STOPPED AT THE LIMIT <t> AFTER YOU LEFT.`

**Given** the simulated player
**When** the pacing report runs
**Then** it prints the food lost at the limit per day, and gate 1 still passes (before and after verdicts in the PR)

**Given** Story 4.4's army trade-off target
**When** food has a limit
**Then** the target is restated (owner decision 2026-11-24, #478): the max-army colony spends more Combat check-ins food-critical than the default one, and `tests/sim/armyTradeOff.test.ts` asserts that in place of "at least one check-in where only the max-army colony is food-critical" (a finite store leaves the default player no buffer from an absence, so the old target held only with an unlimited store); Story 9.18 keeps it as a critical-moment bound

**Covers:** FR62, FR63 (Larder) · FR27 · FR12 (restated)

### Story 9.16: Starvation warns, then shrinks the colony to fit

As a player whose colony eats more than it makes,
I want a warning first, then losses I can see and stop,
So that hunger has stakes without ever wiping my run.

**Acceptance Criteria:**

**Given** food falling toward zero
**When** the sheet's verdict and NEST render
**Then** the warning comes first (`FOOD RUNS OUT IN <t>`, Story 9.11), and once food is at zero and use outruns production it escalates to `STARVING · AN ANT DIES EVERY <t>` in `warn`, with a polite live-region announcement; the first death comes no sooner than `starvationBalance.graceMs` after food reaches zero

**Given** starvation
**When** time passes, live or in catch-up
**Then** one eater dies every `starvationBalance.deathIntervalMs` (tuned between 2 and 10 s; a big deficit never kills faster), chosen at random between workers and soldiers by their counts from a seeded `rng` stream; eggs, larvae and the queen never starve
**And** a dead worker comes off the free pool first, then from the roles in proportion (invariant: workers on roles never exceed workers)
**And** deaths stop as soon as production covers use (shrink to fit): property test over random states, no death happens while the net food rate is zero or better, and the colony never ends a step smaller than the settling size (a pure `getSettlesAt(state)`: the largest colony reached by removing eaters in the death order, free workers first, whose net food rate is zero or better)
**And** the number of deaths is the same for any step length, within one (Story 2.5 property); which eater dies may differ; a numbered save migration adds the starvation clock

**Given** an absence
**When** catch-up runs
**Then** at most 20% of the eaters (workers and soldiers) before the absence can be lost: `OFFLINE_WORKER_FLOOR_SHARE` goes from 0.5 to 0.8 and the floor covers soldiers too (property test)
**And** the return summary says `FOOD RAN OUT <t> AFTER YOU LEFT. <n> WORKERS LOST (NO MORE THAN 20%).`
**And** the warning, the offline cap and the deaths ship in this one story; none of them ships alone

**Given** the room-job choice
**When** a room opens
**Then** it gains `PANTRY` (starvation warns sooner and bites slower: each Pantry room lengthens the grace and the death interval, up to a cap in `data/balance/`; it never stops starvation), as data

**Given** the run
**When** eaters starve
**Then** the run counts them (`starvedWorkers`, `starvedSoldiers`), and the scene thins as today

**Given** the simulated player
**When** the pacing report runs
**Then** it prints deaths per check-in and every starving stretch with its length
**And** the bounds are data in `pacingTargets`, report verdicts: no starvation death in session 1, and no starving stretch in days 2–7 longer than one check-in; gate 1 still passes (before and after verdicts in the PR)

**As built** (#502; owner decision 2026-11-24, #501): only an eater whose death raises the food rate starves (soldiers, workers on a role that brings in no food, and free workers only while an idle worker eats more than it makes), so gatherers and self-feeding free workers never starve and the colony settles instead of dying out; a Pantry stretches the grace and the death interval only (the runway warning does not come sooner). Story 9.17 builds on these.

**Covers:** FR61, FR24, FR4, FR63 (Pantry) · NFR5

### Story 9.17: The resource sheet shows where hunger leads

As a player who is losing ants,
I want the sheet to tell me where the colony will settle and what hunger has cost me,
So that I can decide whether to fix it now or let it shrink.

**Acceptance Criteria:**

**Given** Story 9.16's `getSettlesAt(state)`
**When** the colony is starving or food is falling
**Then** the verdict adds `IF NOTHING CHANGES: SETTLES AT <n> WORKERS.` from it (property test: at n the net food rate is zero or better; with the next eater in the death order added back it is below zero)

**Given** the run has lost ants or food
**When** the sheet's food block renders
**Then** it shows `LOST TO HUNGER: <n> WORKERS · <n> SOLDIERS` (from Story 9.16's counts) and `LOST AT THE LIMIT <n>` (from Story 9.15's), each only once it is above zero
**And** tapping the hunger verdict opens the screen that fixes it (WRKR with Gather highlighted; NEST's room jobs when a Pantry or Larder would help), only on that tap (FR27)

**Given** the sheet's verdict order (Story 9.11, kept in `data/content/`)
**When** starvation and a full store are added
**Then** the order is starving → food falling → food at the limit → nest full with larvae waiting → everything is growing, and a test walks each verdict from a seeded state

**Covers:** FR66 (hunger parts), FR61, FR62 · UX-DR50, UX-DR51

### Story 9.18: Combat fills the first week

As a player on day 4,
I want Combat still to have somewhere to go and something to decide each time I look,
So that the first week ends with the colony I built, not a phase I finished on day 1.

**Acceptance Criteria:**

**Given** the Story 9.16 report
**When** the crowding, room-job, food-limit and starvation values in `data/balance/` and the Combat → Expansion and Expansion → Space guards in `transitions.ts` are tuned
**Then** gate 2 passes (Combat ends on day 6–8) and gate 3 passes (after day 7, the median check-in is 90–120 s and every check-in offers a decision), and gate 1 still passes
**And** the Combat → Expansion guard asks for about 1,000–2,000 workers and a number of battles won that tuning sets, so neither battles alone nor waiting alone clears Combat; Expansion → Space asks for about 5,000 workers or more; worker targets still strictly increase along the phase order (Story 9.9's property test)

**Given** the critical moments (Story 3.11's food- and capacity-critical probes, crowding and starvation)
**When** the report judges them
**Then** each has a lower and an upper bound in `pacingTargets`: Combat has at least one food-critical and one crowded check-in, no crowded stretch holds work at the floor for more than one check-in, and Story 9.16's starvation bounds hold
**And** Story 4.4's restated trade-off holds (Story 9.15): the max-army colony spends more Combat check-ins food-critical than the default one

**Given** the pacing findings of batch 2 (owner triage 2026-11-24: #497, #499)
**When** the agent tunes
**Then** gate 1 passes with a margin (not at the window edge: after Stories 9.13–9.16 it stood at 1m 55s against 2m), using the room size (`digBalance.roomSize`, halved to 3 by Story 9.14), room costs and the crowding slope (`crowdingBalance.perOverfill`) among its values
**And** it decides, and states in the PR, whether crowding should bite in Egg Laying (it does today, where no DIG or NEXT ROOM strip can show or fix it) and how often OVERCROWDING. may spawn in Colony (crowding bites almost all of Colony, so the event is nearly always eligible)
**And** saves from before Story 9.14 keep the capacity of the rooms they already dug (6 a room); this is accepted, not migrated

**Given** gate 3 can't be met by values alone
**When** the agent tunes
**Then** it may add Combat purchasables or decision events that recur in late Combat (owner decision #31), each listed in the PR with the pillar it serves and why no choice is strictly dominated; no new mechanic
**And** if a target still can't be met, it gets as close as it can and explains the gap in the PR (and files it, per `run-all-stories.md`)

**Given** the changes
**When** CI runs
**Then** the reachability test (Story 3.8) passes for every MVP phase, no test hard-codes a tuned number, the E2E seeds still satisfy the real guards, and the story file records the before and after report

**Covers:** FR64 (Phase 3+), FR65 (gates 2–3), FR54

### Batch 3: flavour (later)

A nest close-up (a full-screen nest view, opened from the scene, where every chamber, count, room job, intruder and find can be tapped; it can take over the remaining peek sheets; owner, 2026-11-23), intruders (seeded randomness; guards help), finds, a rhythm bonus on DIG, the milestone pull-out at 1,000 and 10,000 ants, first-time event lines as the tutorial, sharper mandibles (stone), reinforced rooms (stone), a building that sets who starves first.
