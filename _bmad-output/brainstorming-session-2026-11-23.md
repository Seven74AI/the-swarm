---
title: 'Game Brainstorming Session: the resources sheet on mobile, and where food goes (#437)'
date: '2026-11-23'
author: 'Seven74'
version: '1.0'
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
---

# Game Brainstorming Session

## Session Info

- **Date:** 2026-11-23
- **Facilitator:** Game Designer Agent
- **Participant:** Seven74
- **Topic:** Issue #437: the resources sheet is hard to read on a phone (five columns per row, CAP shows "—"), and nothing shows food consumption or what eats it

**Grounding facts (code, main @ f4df023):**
- `src/ui/sheets/ResourceSheet.tsx`: one row per unlocked resource with five columns `AMOUNT · RATE /s · CAP · SOURCE` plus the glyph and the name; CAP reads `—` for every resource without a cap (all but nest capacity today).
- Food eaters: workers 0.5 food/s each (`resourceBalance.upkeepFoodPerSec`), combat soldiers 0.75 food/s each, in training too (`combatBalance`). Food spenders: Click Power, soldier training, buildings, research.
- WRKR already shows `FOOD IN +x/S · EATEN −y/S · NET z/S` (PR #439), but not who eats it.
- Coming in Epic 9 batch 2: a food storage limit (Larder rooms), starvation with a warning (`FOOD RUNS OUT IN 2M`), crowding, room jobs.

---

## Brainstorming Approach

**Selected mode:** Guided

**Technique sequence:**
1. Constraint Box: one thumb, 390 px wide, a 10-second glance
2. Verbs Before Nouns: what the player does with the sheet (why they open it)
3. Economy thought experiments: making food in and food out readable
4. Failure State Design: the hungry and starving colony
5. Reward Schedule / Progression: how the sheet grows across phases (Phase 1 four resources, later twenty)

**Focus areas:** mobile legibility, where food comes from and goes, the food limit and starvation warning from Epic 9 batch 2, the CAP column.

## Ideas Generated (running list)

_Seven74 asked the facilitator to lead with recommendations and kept or dropped each one._

**[Constraint #1]**: The verdict line
_Core Loop_: The sheet opens with one line naming the worst thing first: `FOOD RUNS OUT IN 14M`, `NEST FULL · 3 LARVAE WAIT`, or `EVERYTHING IS GROWING`.
_Novelty_: The sheet answers "am I okay?" before it lists anything. (Kept.)

**[Constraint #2]**: Two short lines per resource
_Core Loop_: Line 1: glyph, name, amount. Line 2 (dim): rate, then source. Replaces the five squeezed columns at 390 px.
_Novelty_: Legible one-handed without shrinking the type. (Kept.)

**[Constraint #3]**: CAP only where there is one
_Core Loop_: The `—` column goes; a capped resource (nest rooms, later food) shows a fill meter `████··· 74%`.
_Novelty_: The cap becomes a picture of how close you are, not a mostly-empty column. (Kept.)

**[Constraint #4]**: Trouble rises
_Core Loop_: Falling or capped resources sort to the top; steady ones below (as the strip does from Phase 3).
_Novelty_: The order itself is information. (Kept.)

**[Constraint #5]**: The food flow block
_Core Loop_: Food gets its own block: `FOOD IN +21/S ← gatherers 18 · idle 3` / `EATEN −18/S → workers 12 · soldiers 6`.
_Novelty_: Answers the playtest's "what eats it?" with no arithmetic. (Kept.)

**[Constraint #6]**: Tap a row for the why
_Core Loop_: Tapping a row opens one level down: where it comes from, what spends it (Click Power, soldiers, buildings), the last spend.
_Novelty_: The sheet stays short; detail is one tap away. (Kept.)

**[Verb #7]**: Jump to the fix
_Core Loop_: Tapping the verdict line opens the screen that fixes it (`FOOD RUNS OUT IN 14M` → WRKR, gather row highlighted). Only on tap; nothing is pushed.
_Novelty_: The player asks, the game answers; unlike the return summary, which no longer suggests moves. (Kept.)

**[Verb #8]**: The food block is a menu
_Core Loop_: `gatherers 18` opens that role row; `soldiers 6` opens WAR.
_Novelty_: The explanation is also the way to act on it. (Kept.)

**[Verb #9]**: Since you last looked
_Core Loop_: `FOOD +1 204 SINCE 14:02 · NET WAS −3/S, NOW +2/S`.
_Novelty_: A reassignment shows its payoff. (Kept.)

**[Verb #10]**: Choose what the strip watches. Dropped: more settings, and the strip sets are designed per phase.

**[Verb #11]**: Text sparklines
_Core Loop_: Each row's dim second line ends with a tiny trend of the last 10 min (`▁▂▃▅`).
_Novelty_: Rising or falling at a glance, in the terminal look. (Kept.)

**[Verb #12]**: Half-height peek sheet. Dropped: the sheet is long, half height cramps it.

_From here on Seven74 accepted every facilitator recommendation ("I'll pick all your recommendations"). Ideas marked Dropped were the facilitator's own recommendation to drop._

### Technique 3: Economy thought experiments (food in, food out)

**[Economy #13]**: Steady flow and one-off spends, kept apart
_Core Loop_: The food block shows the steady per-second flow; one-off spends get their own line: `SPENT THIS HOUR: buildings 1 200 · soldiers 300 · click power 90`.
_Novelty_: Explains a sudden drop that the per-second rate can't. (Kept.)

**[Economy #14]**: One runway number, both ways
_Core Loop_: Net negative: `FOOD LASTS 14M`. Net positive and a limit exists: `FULL IN 2H`. Steady: nothing.
_Novelty_: One number tells you how long you have, whichever way food is moving. Feeds the verdict line (#1). (Kept.)

**[Economy #15]**: The price tag where you decide
_Core Loop_: Every control that adds an eater shows what it costs to feed: the soldier train card `+0.75/S EATEN`, the WRKR `[+]` on a role, a larva maturing.
_Novelty_: The trade-off is visible at the moment of the choice, not afterwards in a sheet (FR12: army size is a real trade-off). (Kept.)

**[Economy #16]**: What the limit throws away (batch 2)
_Core Loop_: Once the food limit ships: `LOST AT THE LIMIT 340 · LAST HOUR`, and the food row's meter shows the limit.
_Novelty_: Makes the Larder's value concrete. (Kept, ships with FR62.)

**[Economy #17]**: The ratio, in ants
_Core Loop_: One line teaches the economy: `ONE GATHERER FEEDS 4.` (from the balance: gather rate ÷ upkeep), shown in the food block and the Gather role row.
_Novelty_: "Every number is an ant": the player learns the rule, not a formula. (Kept.)

**[Economy #18]**: A larder you can see. Parked for the batch 3 nest close-up: a food chamber in the scene that fills and empties.

### Technique 4: Failure State Design (the hungry and starving colony)

**[Failure #19]**: Three steps of hunger
_Core Loop_: The verdict escalates: `FOOD FALLING · LASTS 40M` (dim) → `FOOD RUNS OUT IN 2M` (warn, the batch 2 warning) → `STARVING · A WORKER DIES EVERY 4S` (warn). The strip's FOOD cell turns warn ▼ at the second step.
_Novelty_: The player sees it coming long before anyone dies. (Kept; steps 2–3 ship with starvation, FR61.)

**[Failure #20]**: Where it settles
_Core Loop_: While starving: `IF NOTHING CHANGES: SETTLES AT 84 WORKERS.` Shrink-to-fit is a formula of the current state, so the end point can be computed and shown.
_Novelty_: Turns a vague threat into a number the player can act against. (Kept, top pick for batch 2.)

**[Failure #21]**: The hunger ledger
_Core Loop_: The sheet and LOG keep `LOST TO HUNGER: 12 WORKERS · 3 SOLDIERS` (this run).
_Novelty_: The cost stays visible after the moment passes. (Kept.)

**[Failure #22]**: The fix is one tap from the warning
_Core Loop_: The hunger verdict jumps to the fix (#7): WRKR with Gather highlighted, or WAR when soldiers are most of the eating.
_Novelty_: The warning and the remedy sit together. (Kept.)

**[Failure #23]**: What happened while away
_Core Loop_: The return summary reports, without suggesting a move: `FOOD RAN OUT 2H AFTER YOU LEFT. 18 WORKERS LOST (NO MORE THAN 20%).`
_Novelty_: Fits the owner's rule that the summary only tells what happened. (Kept, ships with FR61.)

### Technique 5: Progression (the sheet across phases)

**[Progression #24]**: Groups once the list gets long
_Core Loop_: Up to about 8 resources, one list. Beyond that, groups by tier (`COLONY`, `BATTLE DROPS`, `SPACE`), collapsed except the group with trouble; falling or capped resources still float to the top.
_Novelty_: The sheet stays one screen from Phase 1 (4 resources) to Phase 5 (about 20). (Kept.)

**[Progression #25]**: The food block appears when something eats
_Core Loop_: Phase 1's sheet is tiny: the verdict and four rows. The food block appears in Colony, when workers start eating.
_Novelty_: Nothing shows before it matters (the reveal pillar). (Kept.)

**[Progression #26]**: A new resource arrives once
_Core Loop_: The first time a resource appears, its row is marked `NEW` until the sheet is next opened, and one event line names its source.
_Novelty_: Ties into batch 3's first-time event lines as the tutorial. (Kept.)

**[Progression #27]**: Slow rates read in minutes
_Core Loop_: Code fact: the sheet truncates rates to whole numbers per second (`formatDeltaFull`), so 0.6 wood/s reads `0`. A rate under 1/s reads per minute (`+36/M`), so a slow resource never looks dead.
_Novelty_: Fixes a real legibility bug and keeps whole numbers (Pillar 1). (Kept.)

---

## Themes and Patterns

- **Answer first, list second:** the sheet opens with a verdict (#1) and a runway (#14); the rows are the evidence.
- **Food is a flow with names:** who brings it, who eats it, what it was spent on (#5, #13, #17).
- **See it coming:** hunger escalates in steps and shows where it will settle (#19, #20).
- **Ask, don't push:** every jump to a fix is the player's tap (#7, #8, #22); the return summary still only reports (#23).
- **Phone-first rows:** two lines, no empty columns, trouble on top, slow rates in minutes (#2, #3, #4, #27).

## Promising Combinations

- **The verdict + runway + jump (#1, #14, #7):** one line that says what's worst, how long you have, and opens the fix when tapped.
- **The food block (#5, #8, #13, #17):** a short ledger whose names are links, with the ratio that teaches the rule.
- **Hunger you can plan for (#19, #20, #21, #23):** the batch 2 starvation surface: warning, end point, ledger, away report.

## Session Summary

### Most Promising Concepts

**Top pick: the verdict line with its runway (#1, #14, #7).** It answers the playtest question ("am I okay?") in one line and works for every phase.

**Runner-up: the food block (#5, #13, #17, #8).** It answers #437's "what eats it?" directly and teaches the economy in ants.

**Honorable mention: where starvation settles (#20).** It makes batch 2's shrink-to-fit legible; build it with FR61.

### Key Insights

- The playtest problem is not too much data but no answer: the sheet lists everything and concludes nothing.
- The CAP column and the zero rates are legibility bugs, not design (#3, #27).
- Most of the food surface depends on Epic 9 batch 2 (warning, limit, deaths), so the sheet rework splits in two: what can ship now and what ships with starvation.

### Recommended Next Steps

1. Turn this into a change through `gds-correct-course` (UX: DESIGN.md resource sheet and UX-DR8; epics: one story now for #1–#6, #13–#15, #17, #24–#27 and the jump links; batch 2 stories pick up #16, #19–#23).
2. Mock the new sheet on the existing canvas or a new one (two phone screens: Colony today, Colony starving).
3. File the slow-rate display bug (#27) as its own small issue if it should land before the rework.

---

## Session Complete

**Date:** 2026-11-23
**Participant:** Seven74

### Output

- 27 ideas (24 kept, 2 dropped, 1 parked)
- 3 developed concepts (verdict line; food block; where starvation settles)
- 5 themes

### Document Status

Status: Complete
Steps Completed: [1, 2, 3, 4]
