---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflow: gds-check-implementation-readiness
mode: non-interactive (unattended agent run; every menu answered with the most reasonable choice, noted below)
date: 2026-11-21
project: the-swarm
baseline_code: "Seven74AI/the-swarm main (branch claude/implementation-readiness)"
documentsIncluded:
  gdd: _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/gdd.md
  gddCompanion:
    - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/epics.md
    - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/decision-log.md
  architecture: _bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md
  adrs: docs/decisions/0001–0005
  epics: _bmad-output/planning-artifacts/epics.md
  ux:
    - _bmad-output/planning-artifacts/ux-designs/ux-the-swarm-2026-11-20/EXPERIENCE.md
    - _bmad-output/planning-artifacts/ux-designs/ux-the-swarm-2026-11-20/DESIGN.md
  changeProposal: _bmad-output/planning-artifacts/sprint-change-proposal-2026-11-21.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-11-21
**Project:** the-swarm
**Assessor:** Claude (gds-check-implementation-readiness, run unattended for `docs/agents/run-all-stories.md` Setup step 4)

**Decisions taken in place of the menus (no one was there to answer):**

1. Step 1 *Continue*: the document set below was used as found. No duplicate had to be resolved (see Step 1).
2. Step 2: the GDD's requirements were checked against the FR/NFR inventory in `epics.md` rather than copied out again. That inventory was extracted from the GDD, and this run checked it line by line against `gdd.md`. Repeating 53 FRs here would only create a second copy that could drift.
3. Contradictions were fixed in the planning docs in the same PR as this report, kept to the owner decisions already logged. The matching GitHub issues were edited so that each stays a copy of its spec section.
4. Claims about the code were checked against `main`. Source code is the authority (CLAUDE.md).

---

## Step 1: Document Discovery

| Type | Whole documents | Sharded | Notes |
|---|---|---|---|
| GDD | `gdds/gdd-the-swarm-2026-11-20/gdd.md` (final v1.0, updated 2026-11-21) | n/a | Companion `epics.md` (high-level epics) and `decision-log.md` (#1–#32) sit in the same folder |
| Architecture | `architecture/architecture-the-swarm-2026-11-20/game-architecture.md` (v1.0, complete) | n/a | ADRs 0001–0005 in `docs/decisions/` |
| Epics and stories | `epics.md` (88 MVP stories; E6/E7 placeholders) | n/a | GitHub issues #231–#318 hold one copy of each story |
| UX | `ux-designs/ux-the-swarm-2026-11-20/EXPERIENCE.md`, `DESIGN.md` (final) | n/a | Reviews, a validation report and 7 HTML mockups sit alongside |
| Other | `sprint-change-proposal-2026-11-21.md` (approved), `briefs/.../brief.md` | | |

**Duplicates:** none. The two `epics.md` files are not duplicates. The GDD folder's copy holds the high-level epic list ("High-level stories only") and points to `../../epics.md` for the implementable stories. The top-level file is the spec.

**Missing:** nothing required. One broken reference: EXPERIENCE.md links `mockups/title-cinematic.html` (Flow 1, Mockups list), and that file does not exist. Story 8.10 has the full text spec, so nothing is blocked (minor; see Step 4).

## Step 2: GDD Analysis

### Functional and non-functional requirements

`epics.md` → *Requirements Inventory* lists FR1–FR53, NFR1–NFR15, AR1–AR27 (architecture) and UX-DR1–UX-DR46 (UX). This run checked the inventory against every section of `gdd.md`:

- Every GDD mechanic row, control rule, upgrade-tree rule, automation rule, prestige rule, number rule, offline rule, phase guard, depth bar, combat interest bar, audio/art rule and technical target appears as an FR or NFR. Owner decisions #24–#31 (correct course and epics) are already in it.
- GDD targets that are tuning values, not requirements, are carried where they belong: Phase 1 tap share (Story 3.9 report), second-run ≤ 50% (FR52, post-MVP), and the Phase 3–5 durations (still `[ASSUMPTION]`, owned by E3 telemetry).
- GDD *Notes for the designer*: tick units → FR40/AR20 (Story 3.2); `antimatter: 0.1` → FR34 (Story 3.3); two offline caps (three in code) → AR3 (Story 2.4); the Swarm Simulator name collision is still open, and no story depends on it.

### GDD completeness

Final, with no open design blockers. Its remaining `[ASSUMPTION]` tags are tuning values, and decision #31 lets agents pick them inside each story's constraints. One wording gap: the GDD *Automation Systems* order lists "hatching (Basic Incubation, Thermal Regulation)" as an automated verb, but hatching has no manual action. In the code, that research adds an automatic egg-laying rate. This is resolved at story level (Story 4.10, below).

## Step 3: Epic Coverage Validation

### Coverage matrix (summary)

| Requirement set | In inventory | Covered by an MVP story (`Covers:` lines) | Not covered by an MVP story |
|---|---|---|---|
| FR | 53 | 47 | FR48–FR53: post-MVP, mapped to the E6/E7 placeholders (by design) |
| NFR | 15 | 15 | none |
| AR | 27 | 26 | AR27: already done on `main` (no story needed) |
| UX-DR | 46 | 43 | UX-DR44–46: post-MVP (E6/E7) |

The *FR Coverage Map* in `epics.md` agrees with the stories' `Covers:` lines. This was checked by script over all 88 stories.

### Missing requirements

None for the MVP. The post-MVP gaps are deliberate: E6/E7 stories are written after the MVP playtest (GDD sequence).

**Coverage: 100% of MVP FRs, 100% of NFRs.**

## Step 4: UX Alignment

**UX documents:** found (EXPERIENCE.md, DESIGN.md, both final).

### UX ↔ GDD

- Aligned on all four correct-course decisions: no web notifications, no hard load budget, in-session pause, and the 60 s window.
- The UX is stricter than the GDD on the minimum viewport: 360×512 with reflow to 320 px, against the GDD's 360×640. Number display is refined per surface (UX-DR3 against the GDD's 999,999 rule). FR35 and NFR7 already take the stricter value, so this is not a conflict.
- The UX extends the GDD with a draw outcome, the CONTINUE latch and the next-action rule. All three are adopted by the architecture (D3) and the stories.

### UX ↔ Architecture

- Every UX surface has an architectural home: tab registry (D7), SheetController priority (D7), overlay layer (D7), decision lifecycle (D8/N3), nest scene (D11/N1), settings outside the save (D4), platform services (D9).
- **Fixed:** a naming contradiction. Architecture D3 said `commit()` emits `phase_changed`, which is the event name in the code today. The architecture's own *Event System* section, its naming table and Story 1.19 say `phase_committed`. D3 now says `phase_committed` replaces `phase_changed`, and Story 1.19 says so explicitly. The code has 6 `phase_changed` listeners (`main.ts`, `UIRoot.ts`, `WorkerAssignment`, `ResearchPanel`, `EventLog`, `PhaseIndicator`), and without this a 1.19 implementer could have left them unsubscribed.

### Warnings

- The broken `mockups/title-cinematic.html` reference (minor, not fixed: the text spec is complete).
- The Story 2.9 warn line `UPKEEP OUTRAN FOOD FOR 20M.` needs a duration. The architecture says the summary is built from the before/after states, which cannot yield a duration, so catch-up must also record how long food stayed at zero (a probe on the collecting bus or on the catch-up loop). Implementable as written; the implementer should know.

## Step 5: Epic Quality Review

### Epic structure

| Epic | Player value | Independence | Verdict |
|---|---|---|---|
| E1 Play one-handed on a phone | yes (title and goal are player-facing) | stands alone | Pass, with a note: it also carries brownfield foundation stories (1.2–1.7, 1.17, 1.34–1.36) that have developer personas. The architecture asks for them explicitly (*First Steps*), and no starter template applies, so they are accepted, not defects |
| E2 Come back to a colony that kept working | yes | needs E1 only | Pass |
| E3 Pace right, never soft-lock | yes (soft-lock rule, pacing) | needs E1–E2 | Pass |
| E4 Every MVP phase is worth playing | yes | needs E1–E3 (reachability gate, data files) | Pass |
| E5 Clean prestige | yes | needs E1–E4 | Pass |
| E8 Looks and sounds like itself | yes | needs E1's selectors and shell (rule recorded in `run-all-stories.md`) | Pass |

### Dependency analysis

No story needs a later story to be completable. Every forward reference is a planned seam, stated in the story itself:

- 1.4 lists the current `Math.random` uses as known exceptions until 3.1.
- 1.22 uses a scene placeholder until 8.5.
- 1.23 is role-data-driven, so Forage appears with 3.4.
- 2.4 already sums Legacy cap raises before 2.8 adds them.
- 1.13 wires the confirm that save import uses in 2.11.
- 1.36 runs after 1.14–1.28.

**Ordering caveats (not defects; implementers must know):**

1. **Save-version churn.** These stories each add a numbered migration: 1.19 (v14, `phaseGoal`), 1.20, 1.26, 1.28, 2.8, 3.1, 3.4, 4.9, 4.10, 5.2, 5.4, 5.6. Building one story at a time keeps them sequential. Story 1.19's "Given save version 13" holds only while it is the first to land.
2. **Story 2.5 comes before Story 3.2.** 2.5 makes every system correct for any `dt` while balance values are still in ticks. Converting ticks to ms locally, or not at all, is fine; 3.2 moves the values later and must keep real-time behaviour unchanged.
3. **Stories 1.24 and 1.15 before 3.4 and 3.5.** BUILD exists in Colony from Story 1.15, but buildings unlock only in Expansion, and wood, stone and nectar have no Phase 2 source, until Stories 3.4 and 3.5. Until then, Colony's BUILD holds research and the converter. E2E seeds must not expect buildings in Colony before 3.5.
4. **Draw outcome.** Story 3.1 asserts the outcome set `victory | defeat | draw`. The code already has a max-rounds "enemy flees" branch (`BattleSystem.ts`), but the explicit `draw` result arrives in Story 4.3. CLAUDE.md's "assert `Victory|Defeat`" testing gotcha should gain `Draw` when 4.3 lands.
5. **Story 5.1 "stays once revealed".** Persisting the LEGACY reveal needs a saved flag (or `lifetime` field) and a migration that the story doesn't name.

### Findings by severity

#### 🔴 Critical (would block or mislead an unattended agent): fixed in this PR

| # | Story / doc | Problem | Fix (docs + issue body) |
|---|---|---|---|
| C1 | Story 3.7 (#287), with 3.8 depending on it | The default sim policy "follows `getNextAction`, rebalances roles, taps CONTINUE". But `getNextAction` applies only after Phase 1, and in the code tapping is the only egg source in Phase 1 (`AutomationSystem` lay rates come from Phase 2+ research and the Legacy Auto Egg Laying). Fighting is not a purchase, so the next-action rule never suggests it. Combat's guard needs `battlesWon ≥ 5`. As written, the Story 3.8 reachability test could not pass for Egg Laying or Combat without sim-only shortcuts, and those are forbidden | The policy also performs the goal verbs that are not purchases, through real actions: it lays eggs in Egg Laying, assigns a GUARD when a condition needs one, and trains soldiers and fights in Combat |
| C2 | Story 2.8 (#274) | The migration mapping said "Chrono Synchronization → its matching node, as the story file maps it". No story file exists: the issue body is the spec. In the code, Temporal Resonance is 50→75% (LP) and Chrono Synchronization is 75→100% (void crystals). Neither has an ownership flag; both live only in `state.offlineEfficiency`. The new chain's single Legacy efficiency node cannot "match" both | Ownership is read from `offlineEfficiency` (0.75 / 1.0). TR maps to the Legacy efficiency node. CS maps to the first Legacy cap-raise node, and the current run's offline research is marked complete. Efficiency = 50 + 25 (research) + 25 (Legacy), in either order. This stays within decision #30 (grant, not refund) and "nothing bought is lost" |

#### 🟠 Major: fixed in this PR

| # | Story / doc | Problem | Fix |
|---|---|---|---|
| M1 | Story 2.1 (#267), AR7 | The story said fixtures exist only for v5–v7 and asked for v1–v13. The code also has `tests/snapshots/v1–v11.json`, used by `saveCompatibility.test.ts`. By the time 2.1 is built, Epic 1 has already raised `SAVE_VERSION` past 13 (1.19, 1.20, 1.26, 1.28), so "v1–v13" would leave the test's own "fixture for the previous version" rule failing | Fixtures cover v1 up to the version before the current one. Reuse `tests/snapshots/` v1–v11 and add v12 onward |
| M2 | Story 4.10 (#301) | "Hatching" is listed as a verb the player performs manually N times, but hatching has no manual action (the pipeline is passive). The hatching research (Basic Incubation, Queen's Pheromones, Thermal Regulation) adds an automatic lay rate in the code | The automatable verbs are egg laying, soldier training and recruitment. "Hatching" automation means egg laying |
| M3 | Story 1.19 (#249), architecture D3 | `phase_changed` vs `phase_committed` (Step 4) | D3 and Story 1.19 now say `phase_committed` replaces `phase_changed` in every emitter and listener |

#### 🟡 Minor: recorded, not changed

- Broken mockup link `title-cinematic.html` (EXPERIENCE.md).
- Story 2.9 duration line needs a catch-up probe (Step 4).
- Story 5.1 reveal persistence needs a migration (Step 5).
- `src/phases/PhaseContent.ts` uses `Math.random` for flavour quotes. It is outside the boundary rule's `systems/`/`sim/` scope (D6 allows UI-only randomness), so it doesn't block Story 3.1's "list is empty" criterion. It would be cleaner seeded or moved to `ui/`.
- `MapSystem` already contains a `mulberry32` generator, which Story 3.1 can reuse for `utils/rng.ts`.
- Acceptance criteria use Given/When/Then throughout and are testable as invariants. Content stories (4.5–4.10) share a standard "agent designs content" block, in line with decision #31.

## Summary and Recommendations

### Overall Readiness Status

**READY** once this PR merges. The plan is complete and consistent, with full MVP coverage. The two critical and three major findings above were all fixable inside the owner's recorded decisions, and are fixed here and in the matching issues (#249, #267, #274, #287, #301).

### Critical Issues Requiring Immediate Action

None left open. C1 and C2 are fixed in this PR.

### Recommended Next Steps

1. Merge this PR, then start the story queue at the lowest open `ready-for-agent` story (Setup step 5 of `run-all-stories.md`).
2. Build strictly one story at a time. That is what keeps the dozen save migrations collision-free.
3. When Story 4.3 lands, update CLAUDE.md's combat testing gotcha to `Victory|Defeat|Draw`.
4. Story implementers should read *Ordering caveats* in Step 5 before Stories 1.24, 2.5, 2.9, 3.1 and 5.1.

### Final Note

This assessment found 10 issues across 3 categories: 2 critical and 3 major issues in story specs and architecture consistency (all fixed), and 5 minor issues in UX references and story details (recorded for implementers). The planning artifacts are fit for unattended implementation.
