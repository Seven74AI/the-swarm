---
title: "UX spec — code-feasibility review"
reviewed: DESIGN.md + EXPERIENCE.md (ux-the-swarm-2026-11-20, draft)
against: "src/ and tests/ at main @ 24da5b1 (HEAD df85663 is docs-only; src/tests identical)"
gdd: _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/gdd.md
date: 2026-11-20
---

# Code-feasibility review

## Verdict

**Feasible with changes.** Nothing in the spec is impossible in the current stack, and no item breaks the repo rules (integer resources, one spread write per tick, `transitions.ts` as the only guard source) if the stories are written as suggested below. The spec is more aligned with the GDD than with the code: most "conflicts" are places where the code still holds pre-GDD baseline behaviour (alternate Colony→Expansion route, 4 h offline cap, wood/stone only from territory, buildings in Phase 4).

Three things need a spec decision before stories are cut:

1. **CONTINUE semantics.** Is a met guard latched or live? Is it re-checked on tap? Which transition fires while Colony still has two outgoing ones?
2. **Check-in resume path.** The spec assumes a resume-from-background summary. The code only computes offline progress on a cold page load.
3. **Decision-event lifecycle.** Spawn timing on load, the sheet queue, and what happens to an open costly or unavoidable event when the app is closed.

The "Implementation notes from Discovery" table is accurate in all four rows, but it understates the work. CONTINUE touches E2E seeds and needs structured guards. The ignore policy needs a sheet manager and a game-time timer. Background pause needs a resume path that doesn't exist.

Status counts (37 rows): **already implemented 2 · small change 15 · significant change 12 · conflicts with code/GDD 8**.
Findings: **critical 1 · high 5 · medium 9 · low 8**.

## Status table

| # | Spec item | Status | Evidence (file:line) | Note |
|---|---|---|---|---|
| 1 | Phase change waits for **> CONTINUE** | Significant | `src/phases/PhaseStateMachine.ts:26-38` (first matching guard fires every tick); `src/main.ts:323-333` (FSM run in the tick, phase written to the signal) | Split the FSM into `evaluate(state) → Transition \| null` (pure, every tick, no side effects) and `commit(t, state, bus)` (runs `onEnter`, called from the CONTINUE handler). `onEnter` side effects (`phase_changed`, `narrative`, `victoryAchieved` at `transitions.ts:116`) then move to tap time. That's fine, because `main.ts:381-385` already drives the reveal from `phase_changed`. Unit tests that assume auto-fire: `PhaseStateMachine.test.ts` (16 `.tick(` calls), `property.test.ts` (10), `combat-phase.test.ts` (6), `Phase3Integration.test.ts` (3). E2E specs that rely on auto-transition: `phase-transition.spec.ts:97-143`, `scroll-discovery.spec.ts:130-275`, `game.spec.ts:30` (egg_laying + 10 workers), `worker-management.spec.ts:90-130`, `transcendence-victory.spec.ts:108-140`, `golden-path.spec.ts:16-111`, `phase3-expansion.spec.ts:18-96`. |
| 2 | One next phase per phase (single guard meter, single CONTINUE target) | Conflicts (code) | `transitions.ts:31` COLONY_TO_COMBAT and `transitions.ts:71` COLONY_TO_EXPANSION, both `from: COLONY`; order in `transitions.ts:128` | The GDD removes the alternate route (gdd.md:223). Until it's removed, Colony has two possible CONTINUE targets. `golden-path.spec.ts` (colony, 40 workers, 5000 food) and `phase3-expansion.spec.ts` (colony, 40 workers, 1000 food) reach Expansion only through this route. |
| 3 | Guard meter: goal in words, one ✓/✗ row per condition | Significant | Guards are opaque lambdas (`transitions.ts:20,34,55,74,90,111-114`); `PhaseIndicator.ts` has no thresholds or progress | To keep `transitions.ts` the only source, add `conditions: {label, current(s), target}[]` to `Transition` and derive `guard` from them. The UI must never restate 50/60/2000. |
| 4 | Guard met while offline → summary's next action is CONTINUE | Small (given #1) | `main.ts:458-563` `processTick` never runs the FSM; today the first online tick auto-fires (`main.ts:327`) under the offline popup | With a pure `evaluate()`, the summary only has to call it on `catchUpState`. Offline sim continuing in the old phase past the guard is harmless (systems are state-gated, not phase-gated). |
| 5 | Prestige / Phase Skip with CONTINUE | Small | `PrestigeSystem.ts:107` sets `phase` directly; `main.ts:326` `fsm.setPhase` resyncs each tick | No latch → nothing to clear on prestige. With a latch, prestige must clear it (save field). GDD rule "Phase Skip must not skip a never-completed phase" (gdd.md:201) is not in the code. |
| 6 | Phase reveal: 3 s palette cross-fade, input blocked ≤ 3.5 s, tap-skip after seen once | Small | Overlay `UIRoot.ts:315-318, 440-506`; `PhaseContent.ts:8` 3500 ms; `main.css:37` `--anim-theme-shift: 3s`, `@property` colour vars `main.css:10-30`, transition `main.css:75` | Reusable. Gaps: the overlay is `pointer-events: none` (`main.css:1252`), so it blocks no input and its click-to-skip handler (`UIRoot.ts:474`) can't fire. Skip is gated on `prestigeCount > 0` (`PhaseContent.ts:181`), not on "seen once", which needs a persisted seen-set. The body class swaps at 300 ms (`PhaseContent.ts:211-213`). Overlay uses `innerHTML` (`UIRoot.ts:459-466`). |
| 7 | Transcendence ending (colony breaks into characters) | Significant | `TranscendencePanel.ts:1-75` is a stats panel; no ending sequence | E7 scope. `victoryAchieved` set in `onEnter` works with CONTINUE. The spec's "Transcendence conversion" (EXPERIENCE.md:32) matches nothing in code or GDD. |
| 8 | Decision event per-event ignore policy (free/costly/unavoidable) + stated outcome | Significant | `DecisionSystem.ts:9-14` (`DecisionEvent` has no policy/timer/outcome fields); `DecisionPopup.ts:4,68-71` 30 s `setTimeout` → `hide()` with no consequence | Add `ignorePolicy`, `timerMs`, `ignoreLine`, and an `ignore` consequence in `CONSEQUENCES` (`DecisionSystem.ts:59`). Apply it via the same `decision_chosen` → `applyChoice` path (`main.ts:340-345`) so it stays a single spread write. |
| 9 | Decision timer pauses in background; ×2 / off setting | Small | Wall-clock `setTimeout` (`DecisionPopup.ts:69`); no `visibilitychange` anywhere in `src/`; pause flag `main.ts:156` | Drive the countdown from game time (tick dt or `playTimeMs`) instead of `setTimeout`. It then pauses for background (rAF stops) and for the in-game pause for free. |
| 10 | Events every 2–3 min, only while open, never queued offline | Conflicts (code) | `DecisionSystem.ts:141` `nextSpawnAt` = 120–180 s absolute, compared with cumulative `stats.playTimeMs` (`main.ts:318`), which offline catch-up also advances (`main.ts:555-560`); `popEvent` ignores `state` (`DecisionSystem.ts:149`) | Any save with > 3 min of play time spawns an event on the first tick after load, on top of the offline summary. Events also fire in Phase 1 (no phase eligibility). Make spawn time session-relative. |
| 11 | Decision sheet: 2 choices, ≤ 2 actions, IGNORE is a policy (not a button) | Conflicts (code content) | `DecisionSystem.ts:42-44` Overcrowding has 3 choices (Expand/Cull/Wait); `:33,54` "Ignore" is a choice button | Content rework (E4). "Wait" makes Overcrowding a de facto free-ignore event, while Flow 4 treats it as unavoidable. |
| 12 | Sheets never stack; a waiting decision shows `•` in the strip | Significant | `DecisionPopup.show` replaces the current event (`DecisionPopup.ts:22-25`); offline popup is a separate overlay (`OfflineSummaryPopup.ts:81-87`); no sheet manager | Needs a single sheet controller (queue + priority: offline summary > decision > others). The ignore timer should start when the sheet opens, not when it's queued. |
| 13 | Worker allocation applies instantly | **Already implemented** | `WorkerAssignment.ts:122-138` (each −/+ calls `assignWorker`/`unassignWorker` then `setState`); `ResourceSystem.ts:313-336` | Matches the spec. |
| 14 | Steppers ×1/×10/×MAX, hold-to-repeat ~8/s | Small | Only ±1 per click (`WorkerAssignment.ts:122-138`); no `pointerdown`/hold handling anywhere in `src/ui` | Add an `assignWorkers(state, role, n)` bulk API so ×MAX is one write. |
| 15 | Role rows Gather, Forage, Tend, Dig, Guard, Research | Significant | `WorkerAssignment.ts:9` roles = gather/tend/dig/guard; `GameState.ts:63-69` has `researchers` but no UI row; `ResourceSystem.ts:315` total ignores `researchers` (can over-assign); no Forage role | Forage (nectar) is new per GDD (gdd.md:113). The Research row needs the `assignWorker` total fixed. |
| 16 | Primary action = "single most useful next action" (CONTINUE → allocation fix → critical-path upgrade → guard progress) | Significant | Nothing exists. Building blocks: `computeResourceRates` (`ResourceSystem.ts:34`), `canBuild`/`getBuildCost` (`BuildingSystem.ts:25,52`), `canPurchaseMutation` (`MutationSystem.ts:107`), `canStartProject` (`ResearchSystem.ts:85`), `canBuild` ships (`SpaceshipSystem.ts:97`) | Build one pure selector `getNextAction(state)` in `src/systems/`, unit-tested on invariants, and share it between NEST, WRKR and the offline summary. "Critical path" needs a defined list per phase (E4 content); the spec doesn't define it. |
| 17 | Offline summary: elapsed, efficiency, per-resource gains/losses, cap reached, one next-action button | Significant | `OfflineSummaryPopup.ts:34-58` shows only duration + efficiency; `main.ts:138-144` emits `offline_progress` with before/after resources, but nothing subscribes and it fires before `UIRoot` is constructed (`main.ts:347`) | Pass before/after state into the sheet directly instead of through the bus. |
| 18 | Offline summary on **resume** after ≥ 1 min (background → foreground) | Significant | No `visibilitychange`/`pagehide` handler in `src/`; `Ticker.ts:83` caps frame dt at 1000 ms, so background time is dropped; catch-up only runs at bootstrap (`main.ts:76-147`) | On a phone, most check-ins are resumes, not cold loads. Flow 2 doesn't work today. GDD E2 ("progress computed on return", gdd.md:315). |
| 19 | Thresholds/copy: summary at ≥ 1 min; `STOPPED GROWING AFTER 12H` | Small | Popup at ≥ 30 s (`main.ts:131`); cap 4 h (`OfflineProgression.ts:97`) vs 8 h in comments (`main.ts:46`, `SaveManager.ts:15-17`) | The spec follows the GDD's 12 h (gdd.md:250). The copy must read the cap from code (Legacy can raise it to 24 h), not hard-code 12H. |
| 20 | Resource strip sets per phase (P2: FOOD, WRKR, WOOD, STON, NECT) | Conflicts (code) | Wood/stone/nectar are produced only from territory bonuses (`ResourceSystem.ts:61-63`), i.e. Phase 4 | Depends on the GDD's new role yields (Gather → wood, Dig → stone, Forage → nectar; gdd.md:113,245). Until then the P2 strip shows three frozen zeros. |
| 21 | Strip refreshes ≤ 4×/s | Small | `ResourcePanel.ts:150-175` updates inside an `effect` on `gameState` (20 Hz, CLAUDE.md #186) | Throttle with a rAF/250 ms gate or `computed` slices. |
| 22 | Numbers: full digits with a space separator to 999 999, then K/M/B; no scientific before Transcendence | Small | `format.ts:68-69` uses `toLocaleString('en-US')` (commas); `:74` prints "1.00M"; `:85-87` scientific from 1e12 regardless of phase; no `break_infinity` dependency anywhere | The spec contradicts itself: DESIGN.md:235 says "full to 999 999" but cites `88.2K` as an example. |
| 23 | "The exact readout, always in integers" | Conflicts (code, pre-existing) | `main.ts:191-204` auto-egg-layer adds `dtSec` (0.05) to `eggs`, `totalEggsLaid`, `eggPipeline.count`; `formatNumber` rounds (`format.ts:59`) | The display can show one more egg than you have. E3 covers this ("fix integer issues"). |
| 24 | 5 tabs (NEST/WRKR/BUILD/FRONT/LOG), segments, per-tab scroll | Significant | `PhaseContent.ts:36-125` reveals panels into one `#panels` column via `UIRoot.createPanel/showPanel` (`UIRoot.ts:367-424`); panels are lazy and `display:none` until their phase | Turn `PHASE_PANELS` into a `{panelId → tab, segment, unlockPhase}` table. Split components: FoodDisplay (rate to strip, upkeep to WRKR); PhaseIndicator (full on NEST, condensed elsewhere); EventLog (see #26). |
| 25 | Panel unlock timing (BUILD with buildings/research/converter in Phase 2; AutoProduction in WRKR in Phase 2) | Conflicts (code) | `building_panel` first in EXPANSION (`PhaseContent.ts:74`); `research_panel` and `resource_converter_panel` in SPACE (`:95-96`); `tech_tree_panel`, `automation_panel`, `prestige_*` only in TRANSCENDENCE (`:117-121`) | The GDD agrees with the spec (buildings in Phase 2, automation research in Phase 2+, gdd.md:154,157). Moving them early without #20 creates a catch-22 (CLAUDE.md): Barracks needs wood, Walls needs stone (`BuildingSystem.ts:17-19`). |
| 26 | Event log: newest 3 on NEST, full log in LOG; tap a line to jump | Small | Entries live in component memory (`EventLog.ts:22`, max 100, `:8`), one shared instance (`UIRoot.ts:101,114`), not saved | Extract a log store that both views read. Decide whether LOG survives a reload (that would be a save field). |
| 27 | Map tile tap selects + opens a tile sheet (mis-tap never commits) | Conflicts (code) | `UIRoot.ts:143-150` tile click → `territorySystem.claimTile` immediately (mutates in place, re-spread) | Contradicts the accessibility rule (EXPERIENCE.md:183). Needs a selection state and a sheet with SCOUT/CLAIM/EXPEDITION. Keep the explicit `onTileClick` wiring (CLAUDE.md). |
| 28 | Star map: planet tap opens a planet sheet | Small | `UIRoot.ts:165-182` `onPlanetClick` → `planet_clicked` → EventLog line (`EventLog.ts:221`) | Re-target the existing callback to a sheet. |
| 29 | Battle summary causal line, **> CHANGE → card**, enemy trait card, round counter | Significant | No traits in `EnemySystem.ts:20-95` (stats only); `lastBattle` has no cause (`GameState.ts:133-139`); battles resolve synchronously in one loop (`BattleSystem.ts:81-174`); a draw outcome exists (`BattleSystem.ts:174`) | Traits and counters are GDD E4 (gdd.md:284-286). The round counter is a presentational replay. The spec has no DRAW state. |
| 30 | First-launch-only cinematic; "replay intro" | Small | Pattern to reuse: `OnboardingManager` keeps a flag in its own localStorage key `the_swarm_onboarding` (`OnboardingManager.ts:17-56`), outside the save; started unconditionally at `main.ts:364-368` | Define first launch as "no save in any slot and no intro flag". Seeded E2E runs then skip it with no migration; see M-8. |
| 31 | Corrupt save / failed migration sheet (LOAD BACKUP / START OVER), never a silent reset | Small | `SaveManager.ts:114-135` silently falls back to bak1/bak2 (console.warn) and returns `null`; `tryLoadKey` swallows migration errors (`:197-228`); `main.ts:76` then starts fresh silently | `load()` needs to return a status (`ok \| recoveredFromBackup \| unreadable`). |
| 32 | Setting: sound, off by default | Small | `AudioSystem.ts:14` `_muted = false`, setter `:35`, not persisted, no UI; sounds limited to `click/prestige/battle/discovery/error` (`AudioSystem.ts:10`) | Flip the default and persist it. Add hatch, decision and phase sounds (E8). |
| 33 | Settings: haptics, notifications | Significant | No `navigator.vibrate`, `Notification` or service worker in `src/` | Platform limits: no Vibration API in iOS Safari; web notifications need a service worker and permission (installed PWA on iOS). Architecture's call. |
| 34 | Settings: reduced motion, CRT effects, decision timers, replay intro, export/import save | Small | `prefers-reduced-motion` appears 0 times in `main.css`; no scanlines; no export/import | Store settings outside the save (as onboarding is) so prestige and import don't wipe them. |
| 35 | Desktop keys: Space = primary action, 1–5 = tabs, Esc | Conflicts (code) | `UIRoot.ts:252-259` Space toggles **pause**; pause button `UIRoot.ts:242-250`; `tests/e2e/pause.spec.ts` | The spec has no pause at all. Decide whether to drop pause or move it to settings. |
| 36 | Tab `•` when something became affordable since last visit | Small | Affordability helpers listed in #16 | Compute through `computed` slices, not an `effect` on the whole state (CLAUDE.md #186). |
| 37 | Repo rules: integer resources, one spread write per tick, guards only in `transitions.ts` | **Already compatible** | CONTINUE, allocation and decisions are user-action writes outside the tick (`main.ts:340-345` pattern) | Pre-existing: the tick writes the signal twice when a phase changes (`main.ts:315` then `:329`). Moving the phase write to CONTINUE removes the second write. |

## Findings

**[critical] C-1. CONTINUE semantics are undefined, and Colony has two exits.**
`PhaseStateMachine.tick` fires and commits in one step (`PhaseStateMachine.ts:26-38`). Guards can stop being met after they were met: workers starve below 50, the only guard is unassigned, or VC is spent on a ship. The spec doesn't say whether CONTINUE is latched or live, or what happens if the guard fails between being met and the tap. Colony also has two outgoing transitions (`transitions.ts:31,71`), so "the" CONTINUE target is ambiguous until the GDD's removal of the alternate route lands.
*Fix (spec):* "CONTINUE is offered while the current phase's guard holds. It's re-evaluated every tick and re-checked on tap. If it no longer holds, the button reverts to the guard meter, and the meter shows the failing ✓/✗ row." This avoids a save field.
*Fix (story notes):* (a) story 1 removes `COLONY_TO_EXPANSION` and migrates `golden-path.spec.ts` / `phase3-expansion.spec.ts` to Combat seeds; (b) story 2 splits the FSM into a pure `evaluate()` and a `commit()` that runs `onEnter` and is called only from the CONTINUE handler; (c) the E2E seeds listed in row 1 click CONTINUE after load (add a `data-action="continue"` selector).

**[high] H-1. There is no resume-from-background path, so the check-in loop (Flow 2) can't happen.**
Background time is dropped by the 1 s dt cap (`Ticker.ts:83`), and offline catch-up runs only at bootstrap (`main.ts:76-147`). "Resume after ≥ 1 min → summary" (EXPERIENCE.md:123) and "timer pauses in background" both need a `visibilitychange` handler that saves on hide and runs catch-up plus the summary on show.
*Fix (story note, E2):* "Resume = `visibilitychange` → visible. Run the same catch-up as cold load, behind one shared function." Note in the spec that cold load and resume behave the same.

**[high] H-2. The guard meter needs guards decomposed inside `transitions.ts`.**
The meter's per-condition rows and goal text ("COMBAT AT 50 WORKERS + 1 GUARD", `workers 37/50`) need numbers that today exist only inside opaque lambdas (`transitions.ts:20-114`). A UI that restates them breaks the "only guard source" rule.
*Fix (story note):* "Add `conditions[]` (label, current, target) to `Transition`, derive `guard` as all-conditions-met, and generate meter text from `conditions`."

**[high] H-3. BUILD in Phase 2 and the P2 strip depend on content the code doesn't have.**
Buildings unlock in Expansion (`PhaseContent.ts:74`), and wood, stone and nectar come only from territory (`ResourceSystem.ts:61-63`). Opening BUILD in Phase 2 with today's costs (`BuildingSystem.ts:17-19`) is a catch-22, and the P2 strip shows three frozen zeros.
*Fix (spec):* tag the P2 strip set and "BUILD appears in Phase 2" as depending on the GDD's role yields (Gather → wood, Dig → stone, Forage → nectar). *Story note:* the E1 tab story ships BUILD with whatever is affordable in Phase 2, or lands after the E3/E4 yield story.

**[high] H-4. The decision-event lifecycle has gaps and a spawn bug.**
(a) The spawn timer is absolute while `playTimeMs` is cumulative and advanced offline, so an event fires on the first tick after every load and lands on top of the offline summary (`DecisionSystem.ts:141`, `main.ts:318,555`). (b) There's no sheet queue: `DecisionPopup.show` replaces the current event (`DecisionPopup.ts:22-25`). (c) The spec doesn't say what happens to an open costly or unavoidable event when the app is closed or reloaded. Without a rule, closing the tab escapes any costly or unavoidable event.
*Fix (spec):* "An event open at close is discarded without outcome (consistent with 'never queued offline'), and the next spawn is ≥ 2 min of foreground play after resume" (or choose to persist it, which needs a save field). "The ignore timer starts when the sheet opens, not when it's queued."
*Story note:* make spawn time session-relative, add phase eligibility to `popEvent`, and build one sheet controller.

**[high] H-5. Map tiles commit on tap today.**
`UIRoot.ts:143-150` claims the tile on click, which contradicts "a mis-tap only selects and never commits" (EXPERIENCE.md:183).
*Fix (story note):* "MapPanel tap sets a selected tile and opens the tile sheet. CLAIM lives in the sheet." Keep the explicit `onTileClick` assignment in UIRoot and the spread after `claimTile` (CLAUDE.md gotchas).

**[medium] M-1. The decision data model and current content don't fit the three-policy model.**
`DecisionEvent` (`DecisionSystem.ts:9-14`) has no policy, timer or ignore consequence. Overcrowding has 3 choices including "Wait" (`:42-44`), and Beetle and Scouts have "Ignore" as a choice. Consequences hard-code amounts that the free-text descriptions restate, so they can drift.
*Fix (story note):* add `ignorePolicy`, `timerMs?`, `ignoreLine` and `ignore: apply` to the event, plus a structured `cost` on each choice from which the visible cost line is generated. Retire "Ignore"/"Wait" as buttons.

**[medium] M-2. The number-format rule contradicts itself and the code.**
DESIGN.md:235 says "full to 999 999" but gives `88.2K` as an example. The code uses commas (`format.ts:69`), prints "1.00M" (`:74`) and goes scientific at 1e12 in any phase (`:85-87`). Fractional eggs from the auto-egg-layer (`main.ts:194`) are rounded for display (`format.ts:59`).
*Fix (spec):* drop `88.2K` and use `1.2M`, `3.4B`, `5.6T`. State the suffix ladder past T. *Story note:* make the formatter floor rather than round; the integer fix is E3.

**[medium] M-3. The guard meter names the next phase, but the spec says nothing about it shows before the tap.**
"COMBAT AT 50 WORKERS + 1 GUARD" (EXPERIENCE.md:84) conflicts with "Nothing about the next phase shows before the tap" (EXPERIENCE.md:107) and the rejected "any preview of later phases" (EXPERIENCE.md:208).
*Fix (spec):* either allow the next phase's *name* on the meter explicitly ("the name, never its colour or content"), or use a neutral label ("NEXT AT 50 WORKERS + 1 GUARD").

**[medium] M-4. Phase-reveal reuse has three defects.**
The overlay doesn't block input (`pointer-events: none`, `main.css:1252`), so its click-skip can't fire (`UIRoot.ts:474`). Skip is keyed to `prestigeCount > 0` (`PhaseContent.ts:181`). "Seen once" needs a lifetime seen-set.
*Fix (story note):* add `revealsSeen: Phase[]` to lifetime data. If it goes in the save, it's a `SAVE_VERSION` 14 step; coordinate it with any other v14 story so both land in one migration function (CLAUDE.md), and make sure prestige keeps it. Alternatively store it beside the onboarding key.

**[medium] M-5. Corrupt saves are recovered silently.**
`SaveManager.load` falls back to backups silently and returns `null` on total failure, and `main.ts:76` then starts fresh with no message. The spec's sheet needs a load status.
*Fix (spec):* say whether a usable backup loads automatically with a notice, or waits for the player to choose. Today it loads automatically.

**[medium] M-6. The event log lives only in component memory.**
LOG's "full event log" and NEST's "newest 3" need a shared store (`EventLog.ts:22`), and the log is lost on reload.
*Fix (spec):* state whether LOG persists across reloads. If it does, that's a save field and migration.

**[medium] M-7. No settings exist today.**
Muted audio defaults to *on* (`AudioSystem.ts:14`), and there's no reduced-motion CSS. Haptics can't work on iOS Safari (no Vibration API), and notifications need a service worker.
*Fix (spec):* "Haptics where supported." Settings live outside the save (as onboarding does) and survive prestige and import. Say whether export includes settings. The GDD says sound is muted by default *on mobile* (gdd.md:303), while the spec says off everywhere; pick one.

**[medium] M-8. The first-launch cinematic will hit E2E tests.**
`OnboardingManager.start()` runs on every boot (`main.ts:364-368`). If the cinematic keys only on an intro flag, every unseeded E2E test (and seeded ones without the flag) gets an 11 s full-screen blocker.
*Fix (spec/story):* "First launch = no save in any slot and intro flag unset." Add a test helper that sets the flag. No save migration is needed.

**[medium] M-9. Space is bound to pause, and the spec has no pause.**
Space toggles pause today (`UIRoot.ts:252-259`, with `pause.spec.ts`), while the spec says Space triggers the primary action (the GDD says Space lays an egg).
*Fix (spec):* say whether pause is removed or moved into settings. If it stays, the decision timer must pause with it (see #9).

**[low] L-1.** The labels aren't all four letters: `EGG` (EXPERIENCE.md:98) and `WRK` (DESIGN.md:246 skeleton) break the rule. *Fix:* "≤ 4-letter label", and align the skeleton with `WRKR`.

**[low] L-2.** The offline sheet threshold is 30 s in code (`main.ts:131`) and 1 min in the spec. The cap copy should read the live cap (4 h in `OfflineProgression.ts:97` today, 12 to 24 h per GDD), not a literal `12H`.

**[low] L-3.** The strip's 4 Hz rule needs a throttle (`ResourcePanel.ts:150`). `TranscendencePanel.ts:31-35` has the #186 pattern (`void gameState.value.prestige` re-renders at 20 Hz). Fix it when it moves to NEST.

**[low] L-4.** Battles can end in a draw (`BattleSystem.ts:174`), but the battle summary has only VICTORY and DEFEAT. *Fix (spec):* add a DRAW line ("THEY RETREATED.").

**[low] L-5.** "The Transcendence conversion" (EXPERIENCE.md:32) matches nothing in code or GDD. *Fix:* name it, or drop it in favour of "the ending".

**[low] L-6.** A Research role row needs `assignWorker`'s total to include `researchers` (`ResourceSystem.ts:315`). Otherwise ×MAX over-assigns.

**[low] L-7.** The per-phase "critical path" used by the primary-action rule (EXPERIENCE.md:100, step 3) isn't defined anywhere. *Fix (spec):* point it at an E4 content table, so the `getNextAction` selector has a data source rather than hard-coded building names.

**[low] L-8.** The decision log tagline reads "ONE EGG. ONE QUEEN. ONE UNIVERSE." (`.decision-log.md:28`), while the spec reads "ONE SWARM". Confirm which one is final.
