---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflow: gds-check-implementation-readiness
mode: owner-started ("go"); menus answered Continue, one design question asked
date: 2026-11-23
project: the-swarm
scope: "Epic 9 batch 1 (Stories 9.1–9.9, issues #443–#451) after the 2026-11-23 correct course"
baseline_code: "Seven74AI/the-swarm main @ f4df023"
documentsIncluded:
  gdd: _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/gdd.md
  gddCompanion:
    - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/epics.md
    - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/decision-log.md
  architecture: _bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md
  adrs: docs/decisions/
  epics: _bmad-output/planning-artifacts/epics.md
  ux:
    - _bmad-output/planning-artifacts/ux-designs/ux-the-swarm-2026-11-20/EXPERIENCE.md
    - _bmad-output/planning-artifacts/ux-designs/ux-the-swarm-2026-11-20/DESIGN.md
  changeProposal: _bmad-output/planning-artifacts/sprint-change-proposal-2026-11-23.md
---

# Implementation Readiness Assessment Report: Epic 9 batch 1

**Date:** 2026-11-23 · **Project:** the-swarm · **Assessor:** Claude (gds-check-implementation-readiness)

Scope: Epic 9 batch 1 only. Epics 1–5 and 8 are built and were assessed on 2026-11-21
(`implementation-readiness-report-2026-11-21.md`). Claims about the code were checked against `main` @ f4df023.

## Step 1: Document discovery

| Type | Document | Notes |
|---|---|---|
| GDD | `gdds/gdd-the-swarm-2026-11-20/gdd.md` (+ companion `epics.md`, `decision-log.md`) | The companion `epics.md` is the GDD's high-level epic list, not a duplicate of `../../epics.md` (same as 2026-11-21) |
| Architecture | `architecture/architecture-the-swarm-2026-11-20/game-architecture.md`, ADRs | Follow-up note for Epic 9 present |
| Epics & stories | `epics.md` | Epic 9 at the end |
| UX | `EXPERIENCE.md`, `DESIGN.md` | Mockups canvas linked, not changed (decision #45) |

No duplicates, nothing missing.

## Step 2: Requirements in scope

FR54–FR59, FR64 (Phase 1–2 part), FR65; changed FR1, FR3, FR5, FR23, FR27, NFR13, NFR14; UX-DR12, UX-DR24,
UX-DR34 (changed), UX-DR47–UX-DR49. Each was checked against the GDD text (*Session Shape*, *Core
Click/Interaction*, *Space and Food*, *Player Progression*, *Difficulty Curve*, *Success Metrics*).
FR60–FR63 are batch 2 and out of scope.

## Step 3: Coverage

| Requirement | Story | Status |
|---|---|---|
| FR54 session shape | 9.1 (schedule), 9.9 (session 1) | ✓ (days 2–7 part waits for batch 2, by plan) |
| FR55 DIG | 9.2 | ✓ |
| FR56 NEXT ROOM | 9.3 (+ 9.5 auto-dig state) | ✓ |
| FR57 FEED | 9.4 | ✓ |
| FR58 auto-dig | 9.5 | ✓ |
| FR59 only dug rooms | 9.6 | ✓ |
| FR64 rescale (Phase 1–2) | 9.9 | ✓ |
| FR65 sim gates | 9.1 (report), 9.9 (gate 1) | ✓ (gates 2–3 batch 2, by plan) |
| UX-DR47 / 48 / 49 | 9.3 / 9.7 / 9.8 | ✓ |

No requirement in scope is uncovered.

## Step 4: UX alignment

- **Conflict (fixed, owner decision #50):** the brood chamber is already a button that opens a peek sheet
  (`src/ui/scenes/NestScene.tsx`, UX-DR34, `tests/e2e/nest-tab.spec.ts`). Story 9.4 made the same tap FEED.
  Owner: from Colony on the tap feeds and the brood peek goes away; the workers peek stays; Phase 1 is
  unchanged. A full-screen nest close-up joins batch 3. UX-DR34, EXPERIENCE.md and Story 9.4 updated.
- Architecture supports the rest: DIG/FEED as `actions/` intents (AR22), dig state stepped in `processTick`
  (D2), scene framing in `nestLayout` (AR14), sim schedule and probes (AR15). Space already triggers the
  primary action (Story 1.30, `src/ui/shell/shortcuts.ts`).

## Step 5: Epic and story quality

Epic 9 delivers player value (a first session without a wall). Stories are sized for one PR each and carry
Given/When/Then criteria testable as invariants.

| # | Story | Finding | Fix |
|---|---|---|---|
| 1 | 9.3 | **Forward dependency:** the strip showed `NEXT ROOM · AUTO-DIG ON`, which only exists after 9.5 | 9.3 drops the auto-dig state; 9.5 adds it to `selectNextRoom` and the strip |
| 2 | 9.6 | Removing the camera steps orphans the `camera-pull-back` feel trigger (`src/platform/gameFeel.ts`), `ui/nest/cameraPullBack.ts` and `feelBalance.cameraPullBackMs` | 9.6 removes them; the room opening takes over the moment, 9.8 adds its sound and haptic |
| 3 | 9.2 | NEST shows `NextActionButton` after Phase 1 today (`src/ui/nest/NestPrimary.tsx`, `[data-nest-primary=next]`); the story didn't say it goes, and `NestPrimary.test.tsx` asserts it | 9.2 states the replacement; BUILD and WRKR keep theirs |
| 4 | 9.9 | **Guard order:** rescaling Colony to 150–300 workers leaves Combat → Expansion (60) and Expansion → Space (80) below it (`src/phases/transitions.ts`) | 9.9 keeps worker targets strictly increasing along the phase order (property test); final values with batch 2 |
| 5 | 9.5 | Auto-dig is priced before 9.9 retunes the curve | 9.5 notes 9.9 may retune the price |

Checked and fine: save migrations (9.2, 9.5) follow the numbered-step rule (`SAVE_VERSION` 34); stone is
produced by digging before auto-dig consumes it (no catch-22); the sim policy presses DIG through the
real action (no sim-only shortcut); no story asserts a balance number.

## Step 6: Summary and recommendations

**Status: READY** after the five fixes above and the brood-tap decision, all applied in the PR that adds this
report. Issues #444, #445, #446, #447, #448 and #451 were edited so each stays a copy of its spec section.

**Next steps:**
1. The owner promotes #443–#451 from `needs-triage` to `ready-for-agent`.
2. The run-all-stories session builds them in order (9.1 first: its report is what 9.5 and 9.9 tune against).
3. Batch 2 stories are written after 9.1's report exists.
