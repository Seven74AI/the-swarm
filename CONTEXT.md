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

### Keyboard shortcuts

Story 1.30 (ADR 0021): `ui/shell/shortcuts.ts` acts on the player's key bindings (settings, Story 1.27). The **primary** key (Space) presses the active tab's primary-zone button as a tap would, only with focus on the page or that button; tab keys (1–5) press the tab-bar buttons; **pause** (P) toggles pause; **close** (Esc) dismisses a non-decision sheet through `SheetController.dismiss()`. Off in settings means no shortcut fires, Esc included. Hover tips show on tap too and Esc dismisses them (`ui/shell/tips.ts`).

### Decision events
A **decision event** (Story 1.28, ADR 0019) is a two-choice situation from `src/data/content/decisions.ts`, with an **ignore policy**: `free` (ignoring costs nothing), `costly` (ignoring applies `ignore`; a timeout is logged and toasted) or `unavoidable` (no timer, must be answered). At most one is open, in `state.decision.open` (saved, with `remainingMs`). Events spawn on the **session clock** (foreground play since this launch, ≥ 2 min), never during an overlay or the offline summary, and never offline. The countdown runs on game time only while the decision sheet is on screen; the decision-timer setting doubles or removes it. Choices and timeouts go through `applyChoice` (`src/systems/DecisionSystem.ts`).

### Next action
The one most useful thing to do now (Story 1.21, UX-DR12, ADR 0015): pure `getNextAction(state)` in `src/systems/NextAction.ts`, read by the UI as `selectNextAction`. First match wins: goal latched → CONTINUE; food critical (net rate < 0 and the stock covers less than `nextActionBalance.foodCriticalSeconds` of upkeep) → a worker to GATHER (or freed from TEND, DIG, or a spare GUARD first); capacity critical (workers ≥ `capacityCriticalPercent` of the effective capacity) → Warehouse if affordable, else a worker to DIG; an affordable item from the phase's **critical-path table** (`src/data/content/criticalPath.ts`); any affordable item; otherwise none, with `NEXT AFFORDABLE: <item> IN ~<time>`. Items are only suggested from panels open in the phase, and every suggestion is an `ActionIntent` that `actions.perform(intent)` accepts. `ui/shell/NextActionButton` keeps the target under the thumb while held and for `targetLockMs` after the last touch.

**BUILD's highlighted card** (Story 1.24): `getBuildAction(state)` (same file, `selectBuildAction`) runs the item rules over the items BUILD sells only (`buildItems`: Click Power from Phase 2, the buildings, the research chain): an affordable critical-path item, then any affordable one, else none with the BUILD item that becomes affordable soonest. That card is drawn `data-selected`, BUILD's pinned `> BUY` buys it, and with none the BUILD header reads `NEXT: <item> IN ~<time>`. Click Power is sold by NEST in Phase 1 and by BUILD (`build_click_power`) after it. The BUILD UI is `src/ui/build/` (UIRoot dep `mountBuild`).

### Chronicle (event log)
The colony's event lines (Story 1.26, ADR 0018): `src/state/chronicle.ts`, newest first, last 100, saved with the game in `SaveData.chronicle` beside the game state (not in it: lines are written by event listeners). One-time lines are chronicle **milestones**, so a reload never repeats them; a prestige starts a new chronicle. NEST shows the newest 3; LOG (`src/ui/log/`) shows all of them, then lifetime stats, the settings entry, and **LEGACY** (prestige and the Legacy tree) once the prestige unlock condition is met (`selectLegacyUnlocked`). A line with a `target` panel jumps to it when tapped.

### Pipelines
Rate-based O(1) processing: `eggPipeline`, `larvaPipeline`, `soldierPipeline`. Each has `count` (rate) and `progress` (accumulated). No per-item timers.

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
Integers only (`Math.floor()`). Food, wood, stone, nectar (phases 1-4). Void crystals, antimatter, dark matter (phase 5+).