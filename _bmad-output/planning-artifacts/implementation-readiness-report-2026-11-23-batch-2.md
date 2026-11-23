---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflow: gds-check-implementation-readiness
mode: run with the correct course (owner chose one PR)
date: 2026-11-23
project: the-swarm
scope: "Epic 9 batch 2 (Stories 9.13–9.18) after the batch 2 correct course"
baseline_code: "Seven74AI/the-swarm main @ bf84654"
---

# Implementation Readiness Assessment: Epic 9 batch 2

The scope is Stories 9.13–9.18 only. Claims about the code were checked against `main` @ bf84654, after batch 1 shipped.

## Documents

The documents are the same set as the batch 1 report (`implementation-readiness-report-2026-11-23.md`), plus
`sprint-change-proposal-2026-11-23-batch-2.md`. There are no duplicates and nothing is missing.

## Coverage

| Requirement | Story | Status |
|---|---|---|
| FR60 crowding | 9.13 | ✓ |
| FR61 starvation | 9.16 (hunger on the sheet: 9.17) | ✓ |
| FR62 food limit | 9.15 (on the sheet: 9.17) | ✓ |
| FR63 room jobs | 9.14 Gallery, 9.15 Larder, 9.16 Pantry | ✓ |
| FR64 Phase 3+ rescale | 9.18 | ✓ |
| FR65 gates 2–3 | 9.18 | ✓ |
| FR66 hunger parts | 9.17 | ✓ |
| FR24 offline floor 0.5 → 0.8 | 9.16 | ✓ |
| UX-DR47 `CROWDED` | 9.13 | ✓ |

## Dependencies

There are no forward references. Each room job ships with the system it changes:
- Gallery with 9.14.
- Larder with 9.15, after the job mechanism exists.
- Pantry with 9.16, after the limit exists.

9.17 reads counts recorded by 9.15 and 9.16. 9.18 tunes all of them.

## Findings (fixed in this PR)

| # | Story | Finding | Fix |
|---|---|---|---|
| 1 | 9.13 | The draft said `workerEfficiency` already slows the diggers' own dig points. `systems/Dig.ts` doesn't apply it; it applies only in `ResourceSystem` (food, role yields) and `GameLoop.getWorkerEfficiency` | The story names the current uses and says crowding *also* slows diggers |
| 2 | 9.16 | "Same result for any step length" can't hold for *which* eater dies: the choice uses randomness, and macro-step catch-up (Story 2.6) draws differently | The property is the number of deaths, within one; which eater dies may differ |
| 3 | 9.16 / 9.17 | "The largest colony whose use production covers" ignores that dead gatherers lower production | One `getSettlesAt(state)` in 9.16, defined by removing eaters in the death order; 9.17 reuses it |

## Checked and fine

- **Migrations:** 9.14, 9.15 and 9.16 add save steps in story order from `SAVE_VERSION` 37. Building one story at a time keeps them sequential.
- **Existing seams:**
  - Peek sheets (`ChamberPeekSheet`, Story 1.14's SheetController).
  - The `room_opened` event.
  - The strip's `data-capped` state.
  - `isStarving` (Story 4.4).
  - `OVERCROWDING.`'s `spawnsWhen: 'crowded'`, which 9.13 rebinds to crowding.
- **No catch-22:**
  - Room-job changes cost stone, which DIG produces from Colony on.
  - The food limit has a property test covering every food cost at each guard.
- **Prestige:** room jobs, food lost and starvation counts are run state, rebuilt from `createInitialState()`.
- **Sim:** the policy picks jobs through the real intent. The gates and bounds are report verdicts, never CI asserts. No story asserts a balance number.
- **Retro rules:** every story names the gates it keeps, and 9.16 and 9.18 carry the critical-moment bounds (decision #62).

## Status

**READY.** The findings above are fixed in this PR. The issues are copies of their spec sections.
