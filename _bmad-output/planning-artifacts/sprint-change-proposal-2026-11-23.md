---
title: "THE SWARM: Sprint Change Proposal (first-week pacing)"
date: 2026-11-23
workflow: gds-correct-course
mode: batch
status: approved
scope: moderate
trigger: "Owner mobile playtest 2026-11-22: quit in Colony at a ~5 h capacity wall two minutes into play (issues #436, #438)"
---

# Sprint Change Proposal: the first week digs in

## 1. Issue summary

**Trigger.** In the owner's mobile playtest (2026-11-22, `_bmad-output/playtest-2026-11-22.md`) the owner
reached Colony and stopped: nest capacity could not reach the 50 workers the Colony goal needs. The wall was
the design working as written, not a bug:

| Code fact (main @ 7f499f1) | Value |
|---|---|
| Start nest capacity | 25 (`createInitialState`) |
| Colony → Combat guard | 50 workers + 1 guard (`src/phases/transitions.ts`) |
| Warehouse | +20 rooms for 1,500 wood + 1,000 stone, cost ×2.5 per level |
| Gather wood / Dig stone | 0.01/s per worker (`roleBalance`) |
| Digging | ~27 h per +1 capacity per digger (`roleBalance.digMsPerRoom` = 96,000,000 ms) |
| Scale penalty | `workerEfficiency` cuts gathering above 500 workers; upkeep doesn't change; invisible |
| Starvation | food clamps at 0; nobody dies; offline floor keeps 50% (`OFFLINE_WORKER_FLOOR_SHARE`) |
| Food storage | no limit |
| `pnpm sim` | Phase 2 = 21 min active over 16 h real (5-min check-ins, 6 a day, by design) |

**Type:** new requirements from playtest evidence; the session shape the GDD assumed (30–90 s check-ins from
day 1) does not hold for a first session.

**Decisions taken before this workflow** (party mode and brainstorm, owner-approved; issue #438 and its comment,
issue #436 and its comment, `_bmad-output/brainstorming-session-2026-11-22.md`):
session shape, scale to thousands, the DIG core (batch 1), space and food (batch 2), flavour (batch 3), and the
three `pnpm sim` gates. Already shipped: the return summary no longer suggests a move (PR #439, FR27 / Story 2.9).

**Decisions taken in this workflow** (owner, 2026-11-23, asked because the inputs left them open):

| # | Question | Decision |
|---|---|---|
| 1 | Phases 1–3 now fill week 1: what happens to first victory (was ~3 weeks)? | **About 4 weeks**: Phase 4 = week 2, Phase 5 = weeks 3–4 |
| 2 | When does Colony end? | **Later on day 1**, in a session after the first; Combat carries days 2–7 |
| 3 | How exact are the rescaled goals? | **Ranges in the GDD**; tuning stories set exact guards against the sim gates |
| 4 | Is capacity still a hard cap under crowding? | **Yes**: hard cap on workers, crowding a separate slowdown counting everyone |
| 5 | Where do the stories live? | **New Epic 9** |
| 6 | iPhone ignores `navigator.vibrate` | **Sound and shake fallback**; no hidden-switch trick in batch 1 |
| 7 | Update the mockup canvas? | **No**; docs state the change (DIG alone, FEED in the scene) |
| 8 | Does FEED cost anything? | **Free** |
| 9 | Auto-dig unlock and price? | **Stone, after a few rooms dug by hand**, priced to land around the end of day 1 |

## 2. Impact analysis

**Checklist results**

| Item | Status | Note |
|---|---|---|
| 1.1 Triggering story | [x] | No story: the playtest of the built MVP (Epics 1–5, 8) |
| 1.2 Core problem | [x] | Session-1 capacity wall; scale too small; space and food have no stakes |
| 1.3 Evidence | [x] | Playtest notes, code facts above, `pnpm sim` |
| 2.1 Current epic | [x] | MVP epics are built; this is post-playtest work |
| 2.2 Epic-level changes | [x] | New Epic 9 (batch 1 written, batches 2–3 listed) |
| 2.3 Future epics | [x] | E6/E7 targets shift by a week (victory ~4 weeks) |
| 2.4 Obsolete / new epics | [x] | None obsolete; Story 3.11 targets superseded; Story 8.7 camera superseded |
| 2.5 Order / priority | [x] | E9 after the MVP playtest, before E6 |
| 3.1 GDD | [!] → [x] | Many sections, listed in §4 |
| 3.2 Architecture | [x] | Follow-up note only; no new primitive, no ADR (fits D1, D2, D11, D12) |
| 3.3 UX | [x] | EXPERIENCE.md (session shape, NEST, next-action rule, offline summary, nest digging layout, flows); DESIGN.md (nest framing, NEXT ROOM strip, brood control) |
| 3.4 Narrative | [N/A] | No narrative doc; batch 3's first-time event lines are flavour |
| 3.5 Other artifacts | [x] | No CI or `src/` change in this PR. `docs/agents/run-all-stories.md` queue extended to Epic 9 |
| 4.1 Direct adjustment | Viable | Add Epic 9 and edit docs |
| 4.2 Rollback | Not viable | Nothing to revert; PR #439 already shipped the summary change |
| 4.3 MVP review | Needed, small | MVP grows by Epic 9 batches 1–2; session shape and victory time change |
| 4.4 Path | [x] | Direct adjustment plus a small MVP review |
| 6.3 Approval | [x] | Owner set every decision (pre-workflow and the nine above) and asked for one PR |
| 6.4 sprint-status.yaml | [N/A] | Status lives in GitHub issues (CLAUDE.md) |

**Epic impact.** E2: the summary rule (already shipped). E3: Story 3.11's targets superseded. E8: Story 8.7's
camera superseded. New E9. E6/E7: targets move by a week.

**Technical impact (for the stories, not this PR).** New dig state with a numbered save migration; `dig`,
`feed` and auto-dig intents in `actions/`; a first-week sim schedule and payoff probes; nest layout framed to
rooms dug; NEST's primary action becomes DIG from Colony. Batch 2 replaces `workerEfficiency` and changes
`OFFLINE_WORKER_FLOOR_SHARE` (0.5 → 0.8) together with starvation deaths.

## 3. Recommended approach

**Direct adjustment with a small MVP review.** Update the GDD, epics, UX and the architecture follow-up in one PR;
add Epic 9; file batch 1 as nine `needs-triage` story issues. Batch 2 stories are written after batch 1 ships,
so they can use its sim report.

- **Effort:** docs low; batch 1 medium (nine stories, one save migration); batch 2 medium–high.
- **Risk:** medium. DIG changes the main loop of Colony; the reachability test and the sim gates catch
  regressions. Starvation deaths are the riskiest piece and ship only with their warning and offline cap.
- **Timeline:** E9 batch 1 → batch 2 → E6.

## 4. Detailed change proposals

### GDD (`gdds/gdd-the-swarm-2026-11-20/gdd.md`)

| Section | Change |
|---|---|
| Front matter, reading note | `updated: 2026-11-23`; playtest, brainstorm and this proposal as inputs; note on what the correction touched |
| Target Audience | 30–90 s check-ins → first week hands-on, tapering to 90–120 s |
| Game Pillars | Structural requirement: 90–120 s check-ins. **Pillar 3** OLD: "Tapping bootstraps Phase 1 only … no late-game mechanic needs repeated tapping." NEW: "Tapping is a boost for the hands-on first week, never a requirement … no mechanic requires repeated tapping, and none after the first week rewards it much." Pillar 4 names starvation and crowding |
| **Session Shape** (new) | Session 1 45–60 min, no wait wall before ~30 min; days 1–3 5–15 min; days 4–7 shrinking; 90–120 s after a week |
| Core Gameplay Loop | Adds the first-week session loop (DIG → FEED → build → dig); check-in 90–120 s; the summary does not point at the decision (PR #439) |
| Win/Loss | Starvation shrinks to fit; queen, eggs, larvae never starve |
| Primary Mechanics | New rows Dig, Feed, Crowding, Starvation, Food storage, Room jobs; Nest capacity = rooms × ants per room + Warehouse, hard cap; scale penalty marked replaced |
| Controls | Tap: dig, feed; Space presses the primary action |
| Core Click/Interaction | LAY EGG (Phase 1), DIG (Phase 2 on), FEED, NEXT ROOM progress, dig feel (iPhone fallback), sharper mandibles planned |
| Automation | Digging (bought auto-dig) added to the order |
| Number Balancing | Scale: thousands; scale penalty replaced in batch 2 |
| Meta-Progression | Worker-efficiency Legacy node scales the work multiplier under crowding |
| Player Progression | Rescaled goal ranges table (10–20 / 150–300 / 1,000–2,000 / 5,000+) |
| Difficulty Curve | OLD: P2 20–40 min / day 1; P3 days 2–3; P4 days 4–7; P5 weeks 2–3; victory ~3 weeks. NEW: P2 ~45–70 min, ends later on day 1; P3 days 2–7; P4 week 2; P5 weeks 3–4; victory ~4 weeks. Session-1 idle-gap defect added |
| **Space and Food** (new) | Hard cap, crowding, starvation, food limit, room jobs, offline-safe rule, starvation-order building later |
| Offline progress | Summary reports only the absence (PR #439); floor 50% → 80% kept with deaths |
| Level Types, Art, Audio | Colony decision type adds dig and feed; nest shows only dug rooms; dig and breakthrough sounds |
| Development Epics | E9 row; sequence |
| Success Metrics | The three `pnpm sim` gates; session metrics; victory ~4 weeks |
| Assumptions | #2, #5, #9 updated; #18 (goal ranges) and #19 (Phase 2 active target) added |

Companion files: `gdds/.../epics.md` (E2 summary bullet and done-when, E3 tuning bullet, new **E9**), `decision-log.md` (#34–#47).

### Epics (`epics.md`)

- **FRs changed:** FR1, FR3, FR4, FR5, FR6, FR23, FR24, FR27, FR40. **New:** FR54–FR65 (FR60–FR63 batch 2).
- **NFRs changed:** NFR13 (90–120 s), NFR14 (no mechanic *requires* repeated tapping).
- **UX-DRs changed:** UX-DR12 (rule no longer drives NEST or the summary), UX-DR24 (no next-action button), UX-DR34 (only dug rooms). **New:** UX-DR47 (NEXT ROOM strip), UX-DR48 (NEST digging layout), UX-DR49 (dig feel).
- **Stories annotated:** 2.9 (summary change, PR #439), 3.11 (targets superseded), 8.7 (camera superseded).
- **Epic 9 added** with Stories 9.1–9.9 and the batch 2 / batch 3 lists; FR coverage map and epic list updated.

| Story | Title | Issue |
|---|---|---|
| 9.1 | The simulated player plays the first week | #443 |
| 9.2 | DIG digs the next room | #444 |
| 9.3 | NEXT ROOM shows how close the next room is | #445 |
| 9.4 | FEED hurries larvae into a free room | #446 |
| 9.5 | Auto-dig hands the digging to the diggers | #447 |
| 9.6 | The nest shows only what I've dug | #448 |
| 9.7 | The NEST tab fits the digging loop | #449 |
| 9.8 | Every dig press feels like moving earth | #450 |
| 9.9 | Tune the DIG core so session 1 never walls | #451 |

### UX (`ux-designs/ux-the-swarm-2026-11-20/`)

- **EXPERIENCE.md:** session shape and check-in term; NEST tab row (DIG / AUTO-DIG ON); new *Nest digging layout*; next-action rule's users; offline summary without a button; nest scene; At capacity and No next action states; Flow 2 and the automation failure path no longer use the summary's button.
- **DESIGN.md:** nest framing replaces the camera steps, crack and opening animation; NEXT ROOM strip and brood control components.
- **Mockups** (https://claude.ai/artifact/Rs3RWvuwqrsbx7p5CWEsNp) left as they are (decision 7).

### Architecture

`game-architecture.md`: a follow-up entry (no new primitive, no ADR) and the `NextAction.ts` row.

## 5. Implementation handoff

**Scope: moderate.** Backlog grows by a new epic; no replan of the architecture.

| Who | What |
|---|---|
| This PR | Docs only: GDD, epics, UX, architecture note, decision log, this proposal |
| Owner | Review the PR; promote the nine Story 9.x issues (#443–#451) from `needs-triage` to `ready-for-agent` |
| Run-all-stories session | Builds Stories 9.1–9.9 in order (`docs/agents/run-all-stories.md`) |
| Next Correct Course or `gds-create-epics-and-stories` | Write batch 2 stories after batch 1 ships, using the Story 9.1 report |

**Success criteria.** After batch 1: `pnpm sim` shows gate 1 passing; Colony ends on day 1 in a later session;
a run that never presses DIG still reaches the Colony goal; reachability passes. After batch 2: gates 2 and 3
pass; starvation never takes the queen, eggs or larvae, and never more than 20% while away.
