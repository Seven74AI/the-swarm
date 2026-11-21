# 0039. Automation targets: the colony keeps a count the player set

- **Status:** accepted (2026-11-21)
- **Source:** Story 4.10 (#301) · FR16, UX-DR16 · GDD "Automation Systems", Pillar 3 (allocation beats clicking)

## Context

Pillar 3 says tapping bootstraps Phase 1 only and automation takes over a verb once the player has shown they
understand it, but never all-or-nothing: each automated verb has a player-set target. The code had one
automation, the research tree's auto-lay rate (Basic Incubation and the rest, shown from Transcendence), and the
pacing report could not measure the "tap share from Colony on" target because nothing laid eggs after Phase 1.
Recruitment had actions but no screen.

## Decision

- **A new primitive, the automation target**: a verb (`AutomationVerb`: `lay`, `train`, `scout`, `warrior`, in
  `data/content/automation.ts`), a whole target (0 to `automationBalance.targets.maxTarget`) and an on switch, kept in
  `GameState.automation.targets`. What the target counts is fixed per verb (`automationCount`): the brood (eggs and
  larvae waiting), the army (`combatSoldiers` + `soldierPipeline.count`, what upkeep is paid on), scouts or warriors
  at home and away. "Keep 20 in training" therefore means an army of 20: losses are refilled, and the colony never
  trains past it.
- **Unlock**: `automation.performed[verb] >= targets.unlockAfterManual` (each successful manual action counts, in the
  action's own write), or the phase after the verb's `introducedIn`. The row shows only once the verb's own phase is
  reached. A pre-v28 save counts its `stats.totalClicks` as laying done by hand. Prestige keeps `automation`.
- **One per-step system**, `tickAutomationTargets`, runs in `processTick` after production, so live play and offline
  catch-up run the same targets (no offline-only path). Training and recruiting are instant top-ups paid as the
  manual verb pays (`trainSoldiers`, `recruitMany`), limited by free workers, food (a starving colony trains no one)
  and, for recruits, the barracks cap. Laying is a rate (`layTapsPerSec` taps' worth of eggs a second, so Click
  Power still counts) with the fraction carried, stopping at the target; it is far slower than tapping, so it keeps a
  brood topped up without replacing Phase 1.
- **Status is derived, not saved**: `automationStatus` gives off / holding / working / blocked with an
  `AutomationBlock` (`food_short`, `no_free_workers`, `barracks_full`), read through per-verb selectors.
- **Offline starvation floor** (Story 2.7) no longer hands back workers the colony itself turned into soldiers,
  scouts or warriors during the absence; otherwise it would make workers from nothing.
- **Decisions stay the player's**: automation never reads or writes `state.decision`.

## Consequences

- Save v28 (`automation`); fixture `tests/saves/v27.json`.
- Rows: NEST's scene under the queen (`lay`), WAR under TRAIN (`train`), and a new RECRUIT section on MAP (`scout`,
  `warrior`, with the manual RECRUIT buttons the verbs needed).
- `tests/unit/engine/stepLength.test.ts` has automation properties (ants conserved, never past target, same
  training target and laying within tolerance for any step length); the integer property test drives the row actions.
- The default simulated player hands laying to the queen once the row appears after Egg Laying (a brood the size of
  the nest) and stops tapping; in Combat it raises the training target instead of pressing TRAIN once the row
  appears. The max-army player still trains by hand.
- Known limit: catch-up credits the absence's food up front (closed form), so automation can spend it from the
  first macro-step, and soldiers it trains offline eat nothing until the next live tick.
