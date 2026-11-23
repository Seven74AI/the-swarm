---
title: "THE SWARM: Sprint Change Proposal (Epic 9 batch 2, space and food)"
date: 2026-11-23
workflow: gds-correct-course
mode: batch
status: approved
scope: moderate
trigger: "Epic 9 batch 1 shipped (Stories 9.1–9.12, PRs #461–#475); batch 2 was listed but not written"
---

# Sprint Change Proposal: space and food (Epic 9 batch 2)

## 1. Issue summary

**Trigger.** Epic 9 batch 1 (the DIG core and the resource sheet) shipped on 2026-11-23. The first correct course
(`sprint-change-proposal-2026-11-23.md`) planned to write batch 2 only after that, from the sim report. Batch 2 was
six outline bullets in `epics.md` with several values left open, so the run-all-stories queue was empty.

**Evidence (main @ bf84654).**

| Code fact | Value |
|---|---|
| Scale penalty | `workerEfficiency` (`engine/ProgressionCurve.ts`), from 500 workers; applied to food and role yields in `ResourceSystem` |
| Starvation | food stops at 0 (`ResourceSystem`); nobody dies; a starving colony trains no one (Story 4.4) |
| Offline floor | `OFFLINE_WORKER_FLOOR_SHARE` = 0.5, workers only (`engine/offlineRules.ts`) |
| Food limit | none |
| Rooms | `digBalance.roomSize` 6; dig state in the save since v35; `SAVE_VERSION` 37 |
| `OVERCROWDING.` | spawns from its own worker-share rule (`DecisionSystem.isCrowded`) |
| Guards (Story 9.9) | 15 / 200 + 1 guard / 400 + 5 wins / 600; the last two marked "final value with batch 2" |
| `pnpm sim` (Story 9.9, PR #472) | gate 1 **PASS** (1m 50s); gate 2 **FAIL** (Combat ends on day 1); gate 3 **FAIL** (median 10 s) |

**Decisions taken in this workflow** (owner, 2026-11-23; GDD decision log #54–#62):

| # | Question | Decision |
|---|---|---|
| 55 | When does crowding start, how far can work fall? | Only once creatures exceed the room space; never below **50%** |
| 56 | How fast do eaters starve? | One every **2–10 s**, set by tuning; a big deficit never kills faster |
| 57 | What sets the food limit before Larders? | **Every dug room stores some**, Larders much more |
| 58 | When are room jobs offered, are they final? | **From Colony**, changeable later for stone |
| 59 | Combat → Expansion wins? | **Tuning sets the wins** as well as the 1,000–2,000 workers |
| 60 | If tuning can't pass gate 3? | The agent may add **Combat purchasables or recurring decision events** (within #31) |
| 61 | Build order? | **Space first, then food**; each room job ships with its system |
| 62 | Critical-moment bounds (retro rule) | No starvation death in session 1; no starving stretch in days 2–7 over one check-in; no crowded stretch at the floor over one check-in; Combat has ≥ 1 food-critical and ≥ 1 crowded check-in |

## 2. Impact analysis

| Item | Status | Note |
|---|---|---|
| 1.1 Triggering story | [x] | None failed: batch 1 complete, batch 2 unwritten |
| 1.2 Core problem | [x] | Gates 2 and 3 fail; space and food have no stakes; the queue is empty |
| 1.3 Evidence | [x] | Table above |
| 2.1 Current epic | [x] | Epic 9 gains Stories 9.13–9.18 |
| 2.2 Epic-level changes | [x] | None beyond writing the listed batch |
| 2.3 Future epics | [x] | E6/E7 unchanged; gate 3 may later move to E6 if Combat can't carry it (the tuning story files the gap) |
| 2.4 Obsolete / new epics | [x] | None |
| 2.5 Order | [x] | Batch 2 → batch 3 → E6 |
| 3.1 GDD | [x] | *Space and Food* values; Combat guard row; reading note; decision log #54–#62 |
| 3.2 Architecture | [x] | No change: the existing follow-up note already covers crowding and starvation as formulas of the state and the 0.5 → 0.8 floor; no new primitive, no ADR |
| 3.3 UX | [x] | EXPERIENCE.md: room-job choice, Starving, Crowded and Food-at-limit states. DESIGN.md already has `CROWDED · −20% WORK` |
| 3.4 Narrative | [N/A] | |
| 3.5 Other artifacts | [x] | `docs/agents/run-all-stories.md` queue extended to the new issues |
| 4.1 Direct adjustment | Viable | Write the stories |
| 4.2 Rollback | Not viable | Nothing to revert |
| 4.3 MVP review | Not needed | Batch 2 was already MVP (GDD E9 row) |
| 6.3 Approval | [x] | Owner set every open value and chose batch mode, one PR |
| 6.4 sprint-status.yaml | [N/A] | Status lives in GitHub issues |

**Technical impact (for the stories).** Three numbered save migrations (room jobs, food lost at the limit, the
starvation clock and counts), in story order. One new seeded `rng` stream (starvation). `workerEfficiency` removed.
The offline floor covers soldiers. The sim report gains crowded check-ins, food lost at the limit, deaths, starving
stretches and the critical-moment bounds.

## 3. Recommended approach

Direct adjustment: write batch 2 as six stories, file them as `needs-triage` issues, extend the run queue, and run
the readiness check in the same PR (the owner chose one PR).

- **Effort:** docs low; batch 2 medium–high (six stories, three migrations, one tuning pass).
- **Risk:** medium. Starvation deaths are the riskiest piece; they come last among the systems, after the player
  has every lever (Gallery, Larder, Pantry), and ship only with their warning and offline cap.

## 4. Detailed change proposals

### Epics (`epics.md`)

- FR60, FR61, FR62, FR63 gain the owner's values; the FR coverage map points at Stories 9.13–9.18.
- Epic 9's intro: batch 1 shipped, batch 2 written, batch 3 listed.
- The batch 2 outline is replaced by:

| Story | Title | Covers | Issue |
|---|---|---|---|
| 9.13 | Crowding slows a nest packed past its rooms | FR60, FR6 (replaced) | #476 |
| 9.14 | A new room can take a job | FR63 (Gallery) | #477 |
| 9.15 | The food store has a limit | FR62, FR63 (Larder) | #478 |
| 9.16 | Starvation warns, then shrinks the colony to fit | FR61, FR24, FR4, FR63 (Pantry) | #479 |
| 9.17 | The resource sheet shows where hunger leads | FR66 (hunger), FR61, FR62 | #480 |
| 9.18 | Combat fills the first week | FR64 (Phase 3+), FR65 (gates 2–3), FR54 | #481 |

Every story names the gates it keeps and asks for before/after verdicts (CLAUDE.md, retro 2026-11-23);
9.16 and 9.18 carry the critical-moment bounds (#62).

### GDD (`gdd.md`)

| Section | Change |
|---|---|
| Front matter, reading note | This proposal as an input |
| Space and Food | Crowding threshold and floor; starvation pace; food limit by rooms and Larders, no loss on load; room jobs from Colony, plain by default, changeable for stone |
| Player Progression | Combat → Expansion row: battles won also set by tuning |

### UX (`EXPERIENCE.md`)

Room-opened line gains the job peek and `<n> PLAIN ROOMS`; State Patterns gain the escalated Starving verdict,
Crowded and Food at its limit.

## 5. Implementation handoff

**Scope: moderate.** One new batch in an existing epic.

| Who | What |
|---|---|
| This PR | Docs: epics, GDD, decision log, UX, this proposal, the readiness report, the run queue |
| Owner | Review the PR; promote Stories 9.13–9.18 from `needs-triage` to `ready-for-agent`; restart the run |
| Run-all-stories session | Builds 9.13–9.18 in order |

**Success criteria.** After 9.18: gates 1, 2 and 3 pass in `pnpm sim`; the critical-moment bounds hold; starvation
never takes the queen, eggs or larvae, and never more than 20% of the eaters while away; reachability passes for
every MVP phase.
