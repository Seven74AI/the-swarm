---
title: 'Game Brainstorming Session: the resources sheet on mobile, and where food goes (#437)'
date: '2026-11-23'
author: 'Seven74'
version: '1.0'
stepsCompleted: [1, 2]
status: 'in-progress'
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

_Ideas will be captured as we progress through the session._
