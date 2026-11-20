---
title: "THE SWARM: Sprint Change Proposal"
date: 2026-11-21
workflow: gds-correct-course
mode: batch
status: approved
scope: minor
trigger: "Final game architecture (PR #211) and ADRs 0001–0005"
---

# Sprint Change Proposal: align GDD and UX with the final architecture

## 1. Issue summary

**Trigger.** No story has been written yet, so no story revealed this. The final game architecture
(`architecture/architecture-the-swarm-2026-11-20/game-architecture.md`, PR #211) and ADRs 0001–0005
record four owner decisions that contradict or go beyond the final GDD (v1.0) and UX (`EXPERIENCE.md`).
The architecture's *Follow-ups for other planning artifacts* asks for this pass.

**Type:** new requirements from the owner during architecture, plus a technical limit (a closed web page
cannot detect events).

| # | Owner decision (2026-11-21) | Evidence | Conflict before this change |
|---|---|---|---|
| 1 | No notifications in the web build; a store build may add them later | Architecture Q2, D9; ADR 0002 consequences, ADR 0004 | GDD *Economy and Resources* and E2 promise opt-in "nest is full" / "offline cap reached" notifications; EXPERIENCE Settings has a notifications toggle |
| 2 | The 2 MB download limit and 3 s first-interactive target are no longer hard constraints | Architecture *Technical Requirements*, *Engine & Framework* note, *Issues Resolved* 1 | GDD *Performance Requirements* and *Asset Requirements*; EXPERIENCE Cold load row |
| 3 | Pause is in-session only; hiding or closing the app ends it | Architecture D1 *Time Model*, *Issues Resolved* 2; ADR 0002 | Not stated anywhere in GDD/UX; EXPERIENCE Paused row and Flow 8 left it open |
| 4 | Gaps under 60 s count at full efficiency | Architecture Q1, D1; ADR 0002 | GDD silent; EXPERIENCE offline-summary threshold was `[ASSUMPTION: 1 min]`, and short gaps had no stated efficiency |

## 2. Impact analysis

**Checklist results**

| Item | Status | Note |
|---|---|---|
| 1.1–1.3 Trigger, problem, evidence | [x] | Table above |
| 2.1 Current epic | [x] | E2 (Offline and check-in) changes: one story removed and replaced, two stories added, done-when extended |
| 2.2–2.4 Epic-level changes | [x] | No epic added, removed or redefined |
| 2.5 Order / priority | [N/A] | Sequence E1 → E2 → E3 ↔ E4 → E5 unchanged |
| 3.1 GDD | [x] | Five sections and the assumption index updated |
| 3.2 Architecture | [x] | Already reflects all four decisions. Only the follow-up note is marked done |
| 3.3 UX | [x] | EXPERIENCE.md: Settings, State Patterns, Offline summary, Responsive & Platform, Flow 8, implementation notes. DESIGN.md: no impact (no notification or pause component) |
| 3.4 Other artifacts | [x] | No CI, deploy or `src/` change. ADRs unchanged. Brief left as historical input |
| 4.1 Direct adjustment | Viable | Low effort, low risk |
| 4.2 Rollback | Not viable | Nothing built yet |
| 4.3 MVP review | Not needed | MVP scope (Phases 1–3) unchanged; E2 gets slightly smaller (no notifications) |
| 4.4 Path | [x] | Option 1, direct adjustment |
| 5.x Proposal components | [x] | This document |
| 6.3 Approval | [x] | The owner set the four decisions and asked for them to be applied in one PR |
| 6.4 sprint-status.yaml | [N/A] | Status lives in GitHub issues (CLAUDE.md), not BMAD sprint files |

**Epic impact:** E2 only. E1's decision-event story ("pauses its own timer while backgrounded") already
matches architecture D8 and stays as it is.

**Technical impact:** none now. Stories written from E2 will carry these rules into code: `resume(elapsedMs)`
with the 60 s split, an unsaved in-memory pause, and the `Notifications` platform interface with no web implementation.

## 3. Recommended approach

Direct adjustment (option 1): edit the GDD, epics and UX text, log each decision, and leave the architecture
and ADRs as the source. Effort: low. Risk: low. Timeline: no impact; `gds-create-epics-and-stories` can start
from the corrected documents.

## 4. Detailed change proposals

### GDD (`gdds/gdd-the-swarm-2026-11-20/gdd.md`)

**Economy and Resources → Offline progress**

OLD:
```
- On return, the player sees a summary sheet: … [ASSUMPTION: floor]
- Optional local notifications: "nest is full" and "offline cap reached". Off by default. [ASSUMPTION: opt-in]
```
NEW:
```
- Short gaps (decided): time away under 60 s … counts at full efficiency and shows no summary. From 60 s on,
  the time is offline: the offline efficiency and cap apply and the summary sheet opens. …
- On return, the player sees a summary sheet: … [ASSUMPTION: floor]
- Pause (decided): pause is in-session only. Hiding or closing the app ends it, and the time away counts as
  normal offline time. A pause is never saved.
- Notifications (decided): none in the web build. … A later store build (native wrapper) may add local
  notifications scheduled at predicted times. The game must never depend on them.
```
Rationale: decisions 1, 3 and 4.

**Technical Specifications → Performance Requirements**

OLD: `First interactive screen in under 3 s on a mid-range phone (about 2022 Android) over 4G. [ASSUMPTION: device class]`
NEW: fast first load is a quality goal, not a hard target (text first, scene fades in, cached later launches);
the reference device (about 2022 Android, `[ASSUMPTION: device class]`) is kept for the remaining targets.
Rationale: decision 2. The 100 ms tap, 60 FPS and 500 ms catch-up targets are unchanged.

**Technical Specifications → Asset Requirements**

OLD: `Total initial download under 2 MB. [ASSUMPTION]`
NEW: `Keep the initial download small. There is no hard size limit (owner, 2026-11-21; this replaces the earlier 2 MB limit).`

**Success Metrics → Technical Metrics:** adds "(load speed is a quality goal, not a pass/fail target)".

**Development Epics → E2 row**

OLD: `12 h cap, single offline model, return summary, opt-in notifications`
NEW: `12 h cap, single offline model, 60 s full-efficiency window, return summary, in-session pause (no notifications on web)`

**Assumption index:** #9 drops "opt-in notifications"; #14 drops "2 MB download".

MVP impact: none on scope; one feature fewer in E2.

### Epics (`gdds/gdd-the-swarm-2026-11-20/epics.md`), E2

| Change | Story |
|---|---|
| Delivers | Lists the 60 s short-gap rule, in-session pause and no web notifications in place of "notifications" |
| Added | Short gaps: under 60 s at full efficiency and no summary; 60 s or more is offline time. Same for background return and cold load |
| Removed | Opt-in local notifications, off by default: "nest is full" and "offline cap reached" |
| Added | Pause is in-session only: hiding or closing ends it; time away is offline time; never saved |
| Added | No notifications in the web build; left to a later store build; nothing may depend on them |
| Done when (extended) | "a gap under 60 s is simulated at full efficiency and opens no summary; a hidden or reloaded app is never paused on return" |

### UX (`ux-designs/ux-the-swarm-2026-11-20/EXPERIENCE.md`)

| Section | OLD | NEW |
|---|---|---|
| Component Patterns → Offline summary | after at least 1 min away `[ASSUMPTION: 1 min; code uses 30 s]` | after at least 60 s away (owner); shorter gaps count at full efficiency, no sheet |
| Settings | Notifications: off by default; denied-permission line | Not in the web build, so there is no toggle; a store build may add one |
| Settings | PAUSE. | PAUSE (in-session only) |
| State Patterns → Cold load | First interactive under 3 s (GDD). | Fast first load is a quality goal with no hard time target |
| State Patterns → Resume from background | ≥ 1 min; under 1 min no sheet | ≥ 60 s; under 60 s full efficiency, no sheet, strip deltas flash |
| State Patterns → Paused | Simulation stops; next tap resumes | Adds: in-session only; hiding or closing ends it; time away is offline time; always reopens unpaused |
| Responsive & Platform | Opt-in notifications (GDD); architecture decides delivery | No notifications in the web build; a store build may schedule them; nothing depends on them |
| Flow 8 failure path | Shortcuts off | Adds: switching tabs or closing the laptop ends the pause; time away is offline time |
| Implementation notes → Space/P | Rebind | Rebind; pause in memory only, hiding ends it |

### Architecture

Unchanged except the *Follow-ups for other planning artifacts* note, now marked done with a pointer here.

### Decision logs

GDD `decision-log.md` #24–#28 (one entry per decision plus the correct-course run). UX `.decision-log.md`: one
summary entry pointing to #24–#28.

## 5. Implementation handoff

**Scope: minor.** Docs only, no `src/` change, one PR.

| Role | Responsibility |
|---|---|
| Developer agent (this run) | Apply the edits above; open one docs PR; CI auto-merges it when green |
| `gds-create-epics-and-stories` (next) | Write E2 stories from the corrected epics: resume with the 60 s split, in-session pause, the `Notifications` interface with no web implementation |
| Owner | Promote resulting issues from `needs-triage` to `ready-for-agent` |

**Success criteria:** no GDD, epics or EXPERIENCE text promises web notifications, a 2 MB or 3 s hard target,
a saved pause, or reduced efficiency for gaps under 60 s; each change has a decision-log entry.

**Found but left out of scope** (not among the four decisions; for a later pass or the stories):
- GDD frontmatter `platforms` ("distribution TBD in architecture") and *Platform-Specific Details* still defer
  distribution and stack to architecture, which has since decided them (PWA on GitHub Pages, optional Capacitor; ADR 0004).
- GDD *Notes for the designer* still lists "two offline caps in the baseline"; architecture D1 replaces them with
  one `getOfflineCapMs(state)`. The code still has both, so the note stays true of the baseline until E2 ships.
