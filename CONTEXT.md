# THE SWARM — Domain Context

## Core Concepts

### Nest Capacity
The maximum number of workers the colony can support. When workers reach capacity, the `larvaPipeline` is blocked — existing workers continue normally, but no new workers hatch until capacity is expanded. This makes `nestCapacity` a real gameplay mechanic (previously cosmetic/dead code).

Capacity is expanded via:
- **Dig workers**: +1 capacity per second per worker (integer-only accumulation, 20 ticks at 50ms = +1)
- **Warehouse building**: +25 per level (soft-capped after Lv.5 via `softCapEffectiveness`)
- **"Expand" decision**: +10 one-time from DecisionSystem

Base capacity: 25. Reset to 25 on prestige.

### Workers
The ant population. Workers consume 0.5 food/sec each (linear). They can be assigned to:
- **Gather**: produce food
- **Tend**: increase egg hatch rate
- **Dig**: increase nest capacity
- **Guard**: soldiers for combat
- **Researchers**: research projects

Unassigned (**free**) workers produce at half gather rate.

**Roles and the workforce** (Story 1.23, ADR 0016): the WRKR rows come from the role data (`src/data/content/roles.ts`: Gather, Tend, Dig, Guard from Colony; Research with the research panel). A researcher leaves `resources.workers`, so the **workforce** is `workers + researchers`, the **assigned total** is the job roles plus the researchers, and **free** workers are the rest (`src/systems/Workforce.ts`). A stepper press is one `actions.stepRole(role, delta)` write; WRKR's primary action (`> MOVE 4 TO GATHER`) is `getReallocation(state)` → `actions.moveWorkers(from, to, count)`: the fewest workers that stop a food loss, or the free workers to DIG when the nest is full, otherwise none. Worker efficiency follows a diminishing-returns curve (`1/(1 + 0.0005 × (workers − 500))` for workers > 500).

### Phases
6 sequential phases: EGG_LAYING → COLONY → COMBAT → EXPANSION → SPACE → TRANSCENDENCE. Phase transitions are gated by resource/worker thresholds and battles. Each phase unlocks new panels, mechanics, and resources.

### Goal
A phase's unlock condition: its outgoing transition in `src/phases/transitions.ts`, made of **conditions** (`{ id, label, current(s), target(s) }`). The guard is derived as "every condition met", so the thresholds exist only there. The goal meter (`ui/shell/GoalMeter.tsx`) reads them through `state/selectors.ts` (`selectGoal`, `selectConditionCurrent/Target/Met`, `selectGoalPercent`) and shows `NEXT: …` without naming the next phase.

### Latch and CONTINUE
The phase never changes on its own (Story 1.19, ADR 0003). Each tick `PhaseStateMachine.evaluate` checks the goal and `latch` writes `state.phaseGoal` (`{ phase, latched, atMs, reached }`) the first time it is met. The latch survives dips and saves: the meter reads `GOAL MET`, a dipped row reads `<now> now, reached <value> at <time>` (game time), NEST gets `•` and its primary action becomes `> CONTINUE` (`[data-action="continue"]`). Tapping it calls `actions.continuePhase`, which runs `PhaseStateMachine.commit` (onEnter, clears the latch, emits `phase_committed { from, to }`). Only `commit` and prestige write `state.phase` (tests/arch/architecture.test.ts).

### Phase reveal and overlays
Committing a phase plays the **phase reveal** (Story 1.20, ADR 0014): a full-screen overlay from the one overlay layer (`ui/shell/OverlayController`, drawn by `OverlayHost`) that blocks input for at most 3.5 s, cross-fades the palette, shows the phase name and types one line. Sheets and decision events wait while an overlay is up. A reveal can be skipped (tap, Enter, Esc) only once its phase is in `state.lifetime.revealsSeen`, which survives prestige.

### Character grid and reflow

Story 1.31 (ADR 0022): text panels sit on a computed **character grid**, `cols = floor(contentWidth / advanceWidth(body))`, marked on `<html data-grid="full|medium|narrow">` (≥ 36, 28–35, < 28 columns). Below 36 meters shrink to `cols − 8` cells and two-column rows stack; below 28 text wraps, box-drawing becomes 1 px borders, meters read `74 % ████····` and aligned tables stack label over value. Nothing clips text. The primary zone un-pins below 480 px of height; NEST shows one event line below 560 px.

### Accessibility floor
Typed decoration (`·`, `→`, brackets, glyphs, 4-letter labels) is visual only: `Deco.tsx` (`Abbr`, `Sep`, `Arrow`, `decorate`) hides it and gives the words. One polite announcer (`[data-announcer]`) says goal met, phase entered, battle result, decision arrived, starving and capacity reached, on their edge, never values per tick. Reduced motion is `:root[data-reduced-motion="true"]` (`motion.css`); CRT in effect is `<html data-crt>`. ADR 0023.

### Voice
The colony speaks in short, present-tense, upper-case lines ending in a full stop; the interface speaks plainly; nothing has an exclamation mark, and no copy names a phase before it is entered (UX-DR42, Story 1.33). **Colony lines** (event lines and narrative beats) live in `src/data/content/colonyLines.ts`, each with the first phase it can be written in; `colonyLine(id, values)` fills them. Decision titles end with a full stop (`OVERCROWDING.`). Short forms (`LV.`, `STR`, `CHTN`) are registered in `src/data/content/abbreviations.ts`, and `decorate()` reads them in full. `tests/arch/voice.test.ts` scans every literal in `src/` for these rules; `tests/e2e/voice.spec.ts` reads the rendered game in every phase.

### Debug overlay, cheats and the seed
Story 1.34 (ADR 0024): `state.seed` (an unsigned 32-bit integer, save v19) is the game's seed; Story 3.1 seeds the generator from it. The **debug overlay** (`src/debug/`, loaded by main as its own chunk in dev builds or with `?debug=1`) opens with the backtick key or a 3-finger long-press: FPS, tick time p50/p95, catch-up time, seed, save version, build, a read-only state inspector, the log ring buffer and EXPORT DIAGNOSTICS. **Cheats** (`window.__swarm.cheats`: `addResources`, `setPhase`, `timeSkip`, `setSeed`) exist only in dev builds; a production build contains none of their code. E2E tests keep seeding saves and don't depend on cheats.

### Resume and lastSeenAt
Story 2.3 (ADR 0026): every way back goes through `resume(elapsedMs)` (`src/engine/resume.ts`): a cold load, the tab becoming visible, a bfcache `pageshow`, a `focus` after sleep, and a visible frame gap over 1 s. **`lastSeenAt`** (save v20) is the wall-clock time the saved state was last simulated to. Hiding the page (`visibilitychange`, `pagehide`, through the platform `Lifecycle`) saves and stops the ticker, so nothing runs while hidden. A gap under 60 s runs at full efficiency with no summary. 60 s or more is **offline time** at the offline efficiency, followed by the offline summary. Each gap is applied once, however many return signals arrive.

### Offline cap
Story 2.4: the **offline cap** is the most resumed time that is simulated. `getOfflineCapMs(state)` (`src/systems/OfflineProgression.ts`) is the only source: `OFFLINE_CAP_BASE_MS` (12 h, `src/data/constants.ts`) plus the `offlineCapRaiseMs` of every owned Legacy upgrade (none until Story 2.8), never above `OFFLINE_CAP_MAX_MS` (24 h). `resume` (through `planOffline`: cold load, return from hidden, frame gaps) and `catchUp` (every catch-up, the dev time skip included) both cut to it; the Ticker has no frame cap; the load info and the summary sheet say whether it was reached and which value applied (`[data-offline-cap]`). `tests/arch/offlineCap.test.ts` fails on any other cap constant or time clamp.

Story 2.6: catch-up runs in **macro-steps**. `catchUp` (`src/engine/catchUp.ts`) advances the planned game time (`ticks × 50 ms`) through the same `processTick` in steps of `CATCH_UP_STEP_MS` (10 s, `src/data/constants.ts`), the last step taking what is left, and logs one `catch-up` summary line. CI checks the **step budget**: a 24 h catch-up calls `processTick` at most `CATCH_UP_MAX_STEPS` times (`tests/unit/engine/catchUpBudget.test.ts`); wall-clock time is never asserted in CI. `pnpm perf` (`vitest.perf.config.ts`, `tests/perf/`) reports the 12 h and 24 h times against `CATCH_UP_BUDGET_MS` (500 ms). It relies on Story 2.5: systems give the same result for any step length; `tests/unit/engine/catchUpEquivalence.test.ts` checks every macro-step against 50 ms steps with 2.5's tolerance (`tests/unit/helpers/stepTolerance.ts`, which now also has `stageRates`).

Story 2.7: **offline-only rules** live in `src/engine/offlineRules.ts` and `catchUp`, never at a call site. During any catch-up no decision event spawns or counts down, no phase is committed (the goal may latch), events go to a queue that is never flushed, and automation runs as the player set it. The **starvation floor** (FR24): after every catch-up step workers are kept at or above `floor(OFFLINE_WORKER_FLOOR_SHARE × workers before the absence)` (0.5, `src/data/constants.ts`); foreground play has no floor. Each rule has an invariant test in `tests/unit/engine/offlineRules.test.ts`.

### Saves
Story 2.2 (ADR 0026): the save lives behind the **SaveStore** (`src/platform/storage/SaveStore.ts`; same keys, 2 rotating backups, plus `the_swarm_save_unreadable`); nothing outside platform/ touches `localStorage`. Loading gives a **load status**: `ok`, `recoveredFromBackup` (no primary; the backup loads, with a warning and one toast), `unreadable` (bad JSON, a newer version or a failing migration) or `empty`. An unreadable save is **never silently reset**: its text is kept aside, every save is held, and `THIS SAVE COULDN'T BE READ.` offers LOAD BACKUP and START OVER. While writes fail, `• SAVE FAILED` sits under the strip and offers EXPORT SAVE; the last good save is untouched.

### Keyboard shortcuts

Story 1.30 (ADR 0021): `ui/shell/shortcuts.ts` acts on the player's key bindings (settings, Story 1.27). The **primary** key (Space) presses the active tab's primary-zone button as a tap would, only with focus on the page or that button; tab keys (1–5) press the tab-bar buttons; **pause** (P) toggles pause; **close** (Esc) dismisses a non-decision sheet through `SheetController.dismiss()`. Off in settings means no shortcut fires, Esc included. Hover tips show on tap too and Esc dismisses them (`ui/shell/tips.ts`).

### Decision events
A **decision event** (Story 1.28, ADR 0019) is a two-choice situation from `src/data/content/decisions.ts`, with an **ignore policy**: `free` (ignoring costs nothing), `costly` (ignoring applies `ignore`; a timeout is logged and toasted) or `unavoidable` (no timer, must be answered). At most one is open, in `state.decision.open` (saved, with `remainingMs`). Events spawn on the **session clock** (foreground play since this launch, ≥ 2 min), never during an overlay or the offline summary, and never offline. The countdown runs on game time only while the decision sheet is on screen; the decision-timer setting doubles or removes it. Choices and timeouts go through `applyChoice` (`src/systems/DecisionSystem.ts`).

### Next action
The one most useful thing to do now (Story 1.21, UX-DR12, ADR 0015): pure `getNextAction(state)` in `src/systems/NextAction.ts`, read by the UI as `selectNextAction`. First match wins: goal latched → CONTINUE; food critical (net rate < 0 and the stock covers less than `nextActionBalance.foodCriticalSeconds` of upkeep) → a worker to GATHER (or freed from TEND, DIG, or a spare GUARD first); capacity critical (workers ≥ `capacityCriticalPercent` of the effective capacity) → Warehouse if affordable, else a worker to DIG; an affordable item from the phase's **critical-path table** (`src/data/content/criticalPath.ts`); any affordable item; otherwise none, with `NEXT AFFORDABLE: <item> IN ~<time>`. Items are only suggested from panels open in the phase, and every suggestion is an `ActionIntent` that `actions.perform(intent)` accepts. `ui/shell/NextActionButton` keeps the target under the thumb while held and for `targetLockMs` after the last touch.

**BUILD's highlighted card** (Story 1.24): `getBuildAction(state)` (same file, `selectBuildAction`) runs the item rules over the items BUILD sells only (`buildItems`: Click Power from Phase 2, the buildings, the research chain): an affordable critical-path item, then any affordable one, else none with the BUILD item that becomes affordable soonest. That card is drawn `data-selected`, BUILD's pinned `> BUY` buys it, and with none the BUILD header reads `NEXT: <item> IN ~<time>`. Click Power is sold by NEST in Phase 1 and by BUILD (`build_click_power`) after it. The BUILD UI is `src/ui/build/` (placed by `ui/gameViews.tsx`, ADR 0025).

### Chronicle (event log)
The colony's event lines (Story 1.26, ADR 0018): `src/state/chronicle.ts`, newest first, last 100, saved with the game in `SaveData.chronicle` beside the game state (not in it: lines are written by event listeners). One-time lines are chronicle **milestones**, so a reload never repeats them; a prestige starts a new chronicle. NEST shows the newest 3; LOG (`src/ui/log/`) shows all of them, then lifetime stats, the settings entry, and **LEGACY** (prestige and the Legacy tree) once the prestige unlock condition is met (`selectLegacyUnlocked`). A line with a `target` panel jumps to it when tapped.

### Pipelines
Rate-based O(1) processing: `eggPipeline`, `larvaPipeline`, `soldierPipeline`. Each has `count` (rate) and `progress` (accumulated). No per-item timers. Story 2.5 (ADR 0028): a step moves the exact share `1 − e^(−k·dt)` of a pipeline (`src/utils/decay.ts`), plus the eggs that hatch and mature within the same step, so one long step moves what many short ones do. Every egg laid (tap, automation, the prestige auto egg layer, the royal cache) is in `eggPipeline.count`: `resources.eggs === eggPipeline.count` and `resources.larvae === larvaPipeline.count`.

### Prestige
Reset loop: sacrifice progress for Legacy Points (LP). LP come from lifetime food produced and the phase reached (`calculateLegacyPoints()` in `PrestigeSystem.ts`) plus an entropy bonus. Each LP adds a production bonus via `productionMultiplier()` in `ProgressionCurve.ts`. LP also buy permanent upgrades in the prestige tree (`src/data/prestigeTree.ts`). Requires all buildings Lv.5 + 100K food lifetime. Void crystals, antimatter, dark matter and survey data carry over the reset.

### Combat Resources
Dropped by enemies in the COMBAT phase. Used for crafting, equipment upgrades, and colony mutations.
- **Silk**: spider drop. Used for armor (soldier defense) and Silk Weaving building.
- **Chitin**: beetle/scorpion drop. Used for weapon (soldier strength) and Chitin Armory building.
- **Venom**: scorpion drop. Used for poison damage (combat DoT) and Venom Lab building.

### Battle and the enemy card
A **battle** is one `actions.fight(enemyType)`: it resolves at once (one write) and ends in **victory**, **defeat** or **draw** (the enemy flees after `MAX_BATTLE_ROUNDS`); `BattleResult` carries the `outcome` and the `rounds` fought. The **enemy card** (FRONT → WAR, Story 1.25, ADR 0017) shows the enemy `> FIGHT` fights, drawn per session and redrawn after each battle (not saved); the **round counter** is a short replay of the rounds after the battle is resolved, then the **battle summary** sheet opens at `battle` priority. Training a combat soldier takes a free worker.

### Equipment
Soldier upgrades purchased with combat resources. `weapon` (chitin) → strength, `armor` (silk) → defense + HP. Upgraded via dedicated buildings.

### Colony Mutations
One-time permanent bonuses purchased with combat resources. Stacking upgrades (e.g. +10% gather, +1 soldier speed, faster larvae hatching).

### Expeditions
Send scouts to map tiles (EXPANSION phase) to harvest resources. Tiles yield: Forest → wood + silk, Mountain → stone + chitin, Meadow → food + venom. Enemy Nests require combat first, then loot.

### Resources
Integers only (`Math.floor()`). Food, wood, stone, nectar (phases 1-4). Void crystals, antimatter, dark matter (phase 5+). Rate-credited amounts go through `creditWhole` (`src/utils/math.ts`): the whole part is credited, the fraction carries in **`resourceRemainder`** (save v21) for food, wood, stone and nectar, and in `conversions.remainder` for each conversion's next run.

### Step length
Story 2.5 (ADR 0028): `processTick(state, …, events, dtSec)` (`src/engine/processTick.ts`) is the one simulation step: main's live tick (50 ms, `TICK_MS` in `src/data/constants.ts`) runs it, then adds the foreground-only parts (decision events, the latch); offline catch-up runs it too. Every system in it gives the same result for one step of `n × 50 ms` as for `n` steps of 50 ms, within the tolerance stated in `tests/unit/engine/stepLength.test.ts`. Balance values still in ticks (mission length, dig rate) are converted with `TICK_MS` until Story 3.2.