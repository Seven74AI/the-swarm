---
title: "THE SWARM — EXPERIENCE"
status: final
created: 2026-11-20
updated: 2026-11-21
form_factor: mobile portrait touch (primary; minimum viewport 360×512, reflow to 320); desktop browser ≥1024 px (secondary)
sources:
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/gdd.md
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/epics.md
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/decision-log.md
  - _bmad-output/planning-artifacts/briefs/brief-the-swarm-2026-11-20/brief.md
baseline_code: "Seven74AI/the-swarm main @ 24da5b1"
---

# EXPERIENCE.md — THE SWARM

> Constraints inherited from the GDD (*Controls and Input*, E1, E2) are referenced, not restated. Visual identity lives in DESIGN.md, which uses the same component names. Owner decisions are recorded in this workspace's `.decision-log.md` (GDD decisions: `decision-log.md` in the GDD folder). Remaining `[ASSUMPTION]` tags mark tuning values the owner hasn't confirmed. Copy quoted in Key Flows is illustrative wherever it is E4 content.

## Foundation

- **Surfaces:** phone, portrait-first, one-handed touch (primary). Desktop browser with mouse and keyboard (secondary): the same screens in more columns. Landscape is never blocked.
- **Engine / UI system:** none committed (architecture decides). Two rendering needs follow from DESIGN.md: a **monospace text UI** on a computed character grid, using a shipped subset font; and a **vector scene layer** for the nest, map, star map, title cinematic, phase reveals and the ending.
- **Session shape** (GDD *Session Shape*, owner 2026-11-22): a 45–60 min first session with no wait wall before about 30 min, sessions of 5–15 min on days 1–3, tapering to 90–120 s check-ins about 6 times a day after a week. Every surface works with under 10 s of attention and survives being dropped mid-action. **Resuming from the background counts as a check-in**, the same as a cold load (see State Patterns).
- **No network needed** to play. Offline is the normal case.

## Glossary (player-facing)

| Term | Meaning |
|---|---|
| **Goal** | A phase's unlock condition (code: the transition guard in `transitions.ts`). Shown as `NEXT: …`, never with the next phase's name |
| **GUARD** | The worker role (GDD). This is the only player-facing use of the word "guard" |
| **Resource labels** | At most 4 letters: EGG, LRVA, WRKR, FOOD, WOOD, STON, NECT, SILK, CHTN, VNOM, VC, ANTM, DKMT, SRVY |
| **Terrain** | Forest, Meadow, Mountain, Empty, Enemy Nest (GDD) |

### Spec terms

| Term | Meaning |
|---|---|
| **Check-in** | A session from a cold load or a resume from the background: 90–120 s in the steady state after the first week |
| **Latch** | Once a goal is met it stays met until CONTINUE is tapped |
| **Next-action rule** | The ordered rule choosing WRKR's suggestion and the tab dots (Component Patterns). It no longer drives NEST from Colony on, or the offline summary |
| **Critical-path table** | Per-phase E4 content listing the items the next-action rule prefers |
| **Ignore policy** | Free, costly or unavoidable: what happens when a decision event times out |
| **Modal sheet / peek sheet** | A modal sheet has a scrim and takes focus; a peek sheet has no scrim and leaves the screen usable |
| **Inverse video** | Selection shown as an accent fill with background-colored text (DESIGN.md) |

## Information Architecture

### Tabs

At most 5 tabs, revealed by phase. A phase adds tabs or segments, never a sixth tab.

| Tab (label) | Appears | Primary action (pinned, bottom zone) | Holds |
|---|---|---|---|
| **NEST** (home) | Phase 1 | Phase 1: **> LAY EGG**. From Colony: **> DIG** (**> AUTO-DIG ON** once auto-dig is bought; a press still boosts). Goal met: **> CONTINUE**. Phase 6 goal met: **> TRANSCEND** | Vector nest scene, phase line, goal meter, newest event lines. **From Colony:** the NEXT ROOM strip and the one-line brood control (Nest digging layout). **Phase 1 only:** the Click Power card once it is first affordable |
| **WRKR** (Workers) | Phase 2 | The single most useful reallocation when one exists (for example, **> MOVE 4 TO GATHER**), otherwise none | Upkeep readout, role rows (Gather, Forage, Tend, Dig, Guard, Research), automation target rows |
| **BUILD** | Phase 2 | **> BUY** on the highlighted card | Buildings (including Click Power from Phase 2), research (with progress and cancel), resource converter |
| **FRONT** (Frontier) | Phase 3 | WAR: **> FIGHT**. MAP: **> SEND EXPEDITION**. STARS: **> LAUNCH** | Segment row that grows: WAR → WAR · MAP → WAR · MAP · STARS, opening on the newest segment. WAR: soldiers, training target, equipment, mutations, enemy card, combat log. MAP: the 8×8 map, the expedition force (scouts and warriors recruited here, capped by Barracks level), active expeditions. STARS: ships, planets, explorations, entropy |
| **LOG** (Chronicle) | Phase 2 | none (a reading surface) | Full event log, lifetime stats, settings (including PAUSE). **LEGACY** section once the GDD's prestige unlock condition is met: prestige and the Legacy tree |

- **Phase 1 has no tab bar.** NEST is the whole game. Entering Colony reveals NEST · WRKR · BUILD · LOG at once; FRONT arrives with Combat.
- **Global, outside tabs:** the resource strip (tap opens the resource sheet, whose `[ SETTINGS ⚙ ]` button makes settings reachable in Phase 1); decision sheets; the offline-summary sheet; phase reveals; the title cinematic (first launch only); the Transcendence ending.

### Panel consolidation (prototype → tab)

| Prototype surface | Destination |
|---|---|
| ResourcePanel, FoodDisplay (rate) | Resource strip, resource sheet |
| PhaseIndicator | Phase line and goal meter (NEST); condensed goal meter on other tabs |
| ClickButton | NEST primary action. The Click Power upgrade is a NEST card in Phase 1 and a BUILD card from Phase 2 |
| EventLog | NEST (newest lines), LOG (full, persisted) |
| WorkerAssignment, FoodDisplay (upkeep), AutoProductionPanel | WRKR |
| BuildingPanel, ResearchPanel, TechTreePanel, ResourceConverterPanel | BUILD |
| SoldierPanel, BattlePanel, CombatLogPanel, MutationPanel | FRONT → WAR |
| MapPanel, ExpeditionPanel (+ scout and warrior recruitment) | FRONT → MAP |
| SpaceshipPanel, StarmapPanel, ExplorationPanel, CosmicPanel (entropy) | FRONT → STARS |
| PrestigePanel, PrestigeTreePanel | LOG → LEGACY |
| TranscendencePanel | NEST, Phase 6 (final goal meter and **> TRANSCEND**) |
| DecisionPopup, OfflineSummaryPopup | Decision sheet, offline-summary sheet |
| OnboardingTooltip | Coach mark |
| NumberDisplay, ProgressBar | `value` text, meter |

### What the NEST shows, top to bottom

1. What changed (strip deltas).
2. How close the goal is (goal meter).
3. The colony (nest scene).
4. What just happened (event lines: 3, or 1 below 560 px viewport height).
5. What to do (primary action).

### Navigation rules

- Nothing is deeper than tab → segment → sheet. No pushed sub-pages.
- Modal sheets never stack. Peek sheets close when a modal sheet opens.
- Each tab keeps its scroll position and segment for the session.

## Voice and Tone

The colony speaks in short, present-tense, upper-case terminal lines. The interface speaks plainly. Neither uses exclamation marks.

| Context | Do | Don't |
|---|---|---|
| Narrative beat | `THE FIRST WORKER STIRS.` | "Congratulations! You unlocked Colony!" |
| Event line | `BEETLES TOOK 3 FORAGERS.` | "Event: Beetle Sighting resolved (−3 workers)" |
| Goal meter | `NEXT: 50 WORKERS + 1 GUARD` · `workers 37/50 need` | `COMBAT AT …` (it names the next phase) |
| Goal latched, then dipped | `GOAL MET · workers 48/50 now, reached 50 at 14:02` | A silent CONTINUE |
| Shortfall | `needs 60 more △` | "Insufficient resources" |
| Battle summary | `DEFEAT` / `VICTORY` / `DRAW · THEY RETREATED.` plus one cause line | "You lost." |
| Decision ignore line | `IGNORE: THE BEETLES TAKE 3 FORAGERS` | A silent timeout |
| Offline summary | `YOU WERE GONE 6H 12M. THE NEST KEPT WORKING.` | "Welcome back! Collect your rewards!" |
| Offline cap | `THE NEST STOPPED GROWING AFTER <cap>.` (reads the live cap) | A hard-coded `12H` |
| Event names | `OVERCROWDING.` | `OVERCROWDING!` (the GDD baseline name; rename it in E4) |
| Title | `ONE EGG. ONE QUEEN. ONE SWARM.` | Anything that names later phases |

Abbreviations are visual only. Every label's accessible name is the full word (Accessibility Floor).

## Component Patterns

Behavior only. Visual specs are in DESIGN.md → Components. Where the two files name things differently:

| DESIGN.md | EXPERIENCE.md |
|---|---|
| Meter (goal) · Condensed goal meter | Goal meter |
| Bottom sheet (decision sheet) | Decision event |
| Bottom sheet | Offline summary, Battle summary, Expedition result |
| Card | Click Power card, Enemy card, Research card |
| Stepper · Role row · Upkeep readout | Stepper / role row |
| Phase reveal | Phase change |
| Glyphs, Secondary action, Disabled, Focus indicator, Title cinematic, Transcendence ending, Desktop left rail | Visual only; behavior is in State Patterns, Accessibility Floor and Game Feel |

| Component | Behavior |
|---|---|
| **Resource strip** | 5 phase-relevant resources (P1: EGG, LRVA, WRKR, FOOD; P2: FOOD, WRKR, WOOD, STON, NECT; P3+: the capped or falling resources rotate in first) `[ASSUMPTION: per-phase sets]`. On screen, values refresh at most 4 times a second. Tapping opens the resource sheet. |
| **Resource sheet** | Answers "am I okay?" first: a verdict line with a runway (tap it to open the fix; nothing opens on its own) and a since-last-look line; from Colony a food block (who brings food, who eats it, one-off spends, `ONE GATHERER FEEDS 4.`), whose names open their role row or WAR; then every unlocked resource on two lines (amount; rate, source, sparkline), caps as meters only where they exist, trouble first, slow rates per minute; tap a row for its sources and spends. `[ SETTINGS ⚙ ]` at the bottom (#437, Stories 9.10–9.12). |
| **Tab bar** | Tap to switch; tapping the active tab scrolls it to the top. `•` when something on that tab has become affordable since the last visit; it clears on visit. |
| **Segment row** | Tap to switch segments; the last-used segment is remembered for the session. |
| **Primary action** | The single most important verb on the current tab, pinned in the bottom zone. **Hold** repeats at about 8/s (GDD). What it shows on NEST and in the offline summary follows the **next-action rule** below. |
| **Stepper / role row** | Every −/+ **applies immediately**, as in today's build. The active multiplier sets the step: ×1, ×10, or ×MAX (as many as available, respecting capacity; Research counts toward the assigned total). Holding repeats. Values stay between 0 and what's available. The upkeep readout updates live. |
| **Automation target row** | Appears under a verb once it can be automated (GDD *Automation Systems*). The stepper sets the target ("keep 20 in training") and `[AUTO]` toggles it. Offline progress runs the same target (GDD). Under the target, `holding at 20` or a `warn` reason (`food short`). |
| **Card** | Only the card's action is tappable, never the whole card. Unaffordable cards show their shortfall. The first time a card becomes affordable it highlights for 2 s. |
| **Click Power card** | Phase 1: appears on NEST under the event lines once first affordable; buying it doesn't change the primary action. From Phase 2 it lives in BUILD. No tap upgrade exists beyond it (GDD). |
| **Research card** | **> START** runs one chain step with a progress meter and time remaining. While running, `CANCEL (50 % BACK)` needs confirmation (hold or two taps), and the refund is shown before you confirm. |
| **Goal meter** | `NEXT: <conditions>`, one row per condition with `met`/`need` and ✓/✗. **Latch:** once every condition is met, the goal stays met until CONTINUE is tapped, even if numbers dip. The meter then shows `GOAL MET`, and any condition that has since dipped reads `<now> now, reached <value> at <time>`. The condensed version shows on the other tabs. |
| **Phase change** | The phase **does not change on its own**. When the goal is met, NEST gets `•` and its primary action becomes **> CONTINUE**; tapping it plays the phase reveal. Nothing about the next phase shows before the tap. |
| **Decision event** | A bottom sheet with the situation, 2 choices with visible cost or risk, and its ignore line. Spawning, ignore policies and lifecycle: **Decision events** below. |
| **Offline summary** | Shown on any resume (cold load or return from the background) after at least 60 s away (owner, 2026-11-21; the code uses 30 s today). Shorter gaps count at full efficiency and open no sheet (State Patterns → Resume from background). Elapsed time, efficiency %, gains and losses with glyphs, whether the cap was reached. **No next-action button:** the sheet reports only what happened while away (owner, 2026-11-22, PR #439). |
| **Battle summary** | VICTORY, DEFEAT or DRAW; losses; drops; one cause line; **> CHANGE → <card>** opens the relevant mutation or equipment card. |
| **Enemy card** | Type and trait shown before committing (GDD Combat interest bar). **> FIGHT** is the primary action. |
| **Expedition force** (FRONT · MAP) | Steppers for scouts and warriors, capped by Barracks level (scouts from Lv.1, warriors from Lv.2). Recruiting pulls directly from workers. This is separate from combat soldiers, which train in WAR. |
| **Expedition result** | A modal sheet: success, partial or failure; losses split proportionally (GDD); loot; tiles revealed. |
| **Map tile** | A tap **selects** the tile (inverse video) and opens a **peek sheet** with its terrain, yield, risk and actions (SCOUT / CLAIM / EXPEDITION). **A tap never commits.** Tapping another tile retargets the sheet; swipe down or `[ CLOSE ]` closes it. The map auto-scrolls so the selected tile sits at least 16 px above the sheet. The FRONT primary action is hidden while the peek sheet is open. Below 352 px of content width, tiles stay at 40 px and the map pans. **Non-drag alternative:** a `[◂ ▸ ▴ ▾]` pan control appears whenever the map overflows. |
| **Star map** | A tap on a planet opens its peek sheet: resource, ships there, exploration progress and actions. |
| **Nest scene** | Mostly watch-only. Each chamber is a separate focusable control; activating it opens a peek sheet with that chamber's counts. From Colony, a tap on the brood is FEED and the brood no longer opens a peek (its counts stay in its label and the brood line); the workers chamber keeps its peek. A full-screen nest close-up is planned with batch 3. The scene shows only the rooms dug so far and grows with each room (DESIGN.md); it no longer zooms. |
| **Bottom sheet** | Non-decision sheets close with swipe down, a tap on the scrim, `[ CLOSE ]` or Esc. Decision sheets close only by a choice or a timeout. |
| **Hold-to-confirm** | For irreversible actions: prestige, research cancel, save import. The default is a 1 s hold (duration adjustable). **Two-tap mode** (setting): the first tap arms the action for 5 s and the second confirms. Holding Enter or Space works the same on a keyboard. |
| **Toast** | One line for 2 s, replacing any earlier toast. Never the only place something you must act on appears. |
| **Coach mark** | One element, one line, once per concept. Dismissed by performing the action it points to, or by `[ GOT IT ]`; the dismissing tap is consumed. Also announced politely to screen readers. |
| **Event line** | Newest first; persisted with the save (LOG). Tapping a line that points at something jumps to it. |

### Nest digging layout (Colony on)

*Correct Course 2026-11-23 (Epic 9, Story 9.7). Mockups: https://claude.ai/artifact/Rs3RWvuwqrsbx7p5CWEsNp; their two-button row is superseded: DIG is the only main button and FEED is a tap on the brood in the scene.*

Top to bottom: goal block condensed to at most 4 lines → nest scene (only the rooms dug so far, no camera crop) → **NEXT ROOM strip** (`NEXT ROOM +5 [ ██████ ············ ] IN 4M · 13 DIGS`; `NEXT ROOM · AUTO-DIG ON` once bought; `NO DIGGERS` in place of the time when nobody digs; batch 2 adds `CROWDED · −20% WORK`) → brood control on one line (`BROOD 4 EGGS · 2 LARVAE  KEEP [−] 10 [+] AUTO`) → event lines → pinned **> DIG** with a hint line (`chunk +1 · 3 stone · tap the brood to feed when a room is free`).

- **DIG:** one press digs one chunk; hold repeats like every primary action. Each room takes more presses than the last. A crack at the dig face grows with progress.
- **FEED:** tapping the brood in the scene (a labelled button, "Feed the brood") hurries larvae into a free room. Free. With no free room it reads `FEED · NEST FULL` and is disabled.
- **Room opens:** a quick opening animation, an event line (`ROOM 7 OPENED.`), the picture grows by one room. Batch 2 (Stories 9.14–9.16): a one-tap job choice (Gallery, Larder, Pantry) as a peek with the room line, plain always allowed and the default; it never blocks DIG. Rooms opened by diggers, auto-dig or while away open plain; NEST shows `<n> PLAIN ROOMS` to assign later, and a job can be changed later for stone.
- **Never required:** diggers dig on their own, slowly; no nudges, no pressure, no penalty for not tapping.

### Next-action rule

Used by WRKR's suggestion, the tab dots and the simulated player (from Colony on, NEST shows DIG; the offline summary has no action since PR #439). First match wins:

1. Goal met → **> CONTINUE** (Phase 6: **> TRANSCEND**).
2. Food critical (net food rate below 0 and stock under 60 s of upkeep) → the allocation fix.
3. Capacity critical (≥ 95% of nest capacity) → more diggers or Warehouse (on NEST, DIG is already the button).
4. An affordable item from the phase's **critical-path table** (E4 content, one table per phase; never hard-coded names).
5. Any affordable item.
6. None → no button; the zone shows `NEXT AFFORDABLE: <item> IN ~<time>`.

Thresholds are `[ASSUMPTION]`. **Stability:** the target is locked while a hold is active and for 1 s after the last tap, so it never changes under the thumb.

### Decision events

- **Spawning:** only while the game is open and in the foreground; at most one at a time; every 2–3 min of foreground play this session (the timer resets each session). Never before the offline-summary sheet is dismissed, and never during a reveal, the cinematic or the ending (it waits and fires afterward).
- **Ignore policies** (one per event; owner decision): **(1) free**: timer, `IGNORE: NOTHING HAPPENS`. **(2) costly**: timer, `IGNORE: <outcome>`; on timeout the outcome applies, is written to the log and toasts once. **(3) unavoidable**: no timer, no dismiss. Which event gets which policy is E4 content.
- **Lifecycle:** an open event survives backgrounding and closing the app with its timer paused (GDD), and reopens on resume, so closing the app is never a free escape.
- **Timer settings:** timers for policies 1 and 2 can be doubled in length (×2) or turned off. The first timed event shows a one-time hint, `TIMERS CAN BE SLOWED IN SETTINGS`.

### Settings

Reached from the resource sheet (`[ SETTINGS ⚙ ]`) and LOG.

- Sound: off by default; respects the device's silent mode.
- Haptics.
- Reduced motion (also follows the OS).
- CRT effects: SCENE (default) / FULL / OFF.
- Decision timers: normal / ×2 (longer) / off.
- Confirm style: hold / two taps, plus hold duration.
- Lay mode (Phase 1): hold / toggle, at the same rate.
- Keyboard shortcuts: on/off, remappable.
- Notifications: **not in the web build** (owner, 2026-11-21), so the web settings have no notifications toggle. A later store build may add one (Responsive & Platform).
- Replay intro.
- PAUSE (in-session only; see State Patterns → Paused).
- Export and import save.

Text size follows the browser.

## State Patterns

| Surface | State | Treatment |
|---|---|---|
| App | **First launch** (no save **and** no first-launch flag, a separate localStorage key) | The title cinematic (about 11 s, Phase 1 visuals only) plays. Skip with a tap, Enter, Space or Esc. It ends on **[ TAP TO WAKE THE QUEEN ]** (a real button), then `A QUEEN, ALONE.`, the brood chamber, and a coach mark on LAY EGG. E2E tests set the flag. |
| App | Later launches | Straight to NEST. |
| App | Cold load | Terminal text (strip, phase line, primary action) renders first; the vector scene fades in when ready. Fast first load is a quality goal with no hard time target (GDD, owner 2026-11-21). |
| App | **Resume from background** (≥ 60 s) | Offline catch-up runs and the offline-summary sheet opens, exactly as after a cold load. After less than 60 s away, the time counts at full efficiency (GDD), no sheet opens, and the strip deltas flash once. |
| App | Corrupt save or failed migration | Sheet `THIS SAVE COULDN'T BE READ.` with LOAD BACKUP or START OVER. Never a silent reset. |
| App | Save write failed / storage full | Persistent strip marker `• SAVE FAILED`; tapping it explains and offers EXPORT SAVE. |
| App | Import | Invalid file → `THAT FILE ISN'T A SWARM SAVE.` Valid file → a confirm sheet stating that it replaces the current run (hold-to-confirm). |
| App | Paused (LOG → settings, or P on desktop) | `PAUSED` overlay line; the simulation stops; the next tap resumes. **In-session only:** hiding or closing the app ends the pause, and the time away counts as normal offline time (the resume rows above apply). The game always reopens unpaused. |
| NEST | Phase 1, nothing hatched | Empty chamber with the queen; `EGGS HATCH INTO LARVAE.` |
| NEST | Phase 1, Click Power affordable | The Click Power card appears under the event lines. |
| NEST | Starving | FOOD turns `warn` ▼; an event line; next-action rule (2); the drawn colony visibly thins. Batch 2 (Story 9.16): the verdict escalates `FOOD RUNS OUT IN <t>` → `STARVING · AN ANT DIES EVERY <t>`, then `IF NOTHING CHANGES: SETTLES AT <n> WORKERS.` (Story 9.17). |
| NEST | Crowded | Batch 2 (Story 9.13): the NEXT ROOM strip adds `CROWDED · −<n>% WORK` in `warn`; the overfill spills into the tunnels in the scene. |
| Strip | Food at its limit | Batch 2 (Story 9.15): FOOD shows its capped state; the sheet's runway reads `FULL IN <t>` while rising; the return summary says `FOOD STOPPED AT THE LIMIT <t> AFTER YOU LEFT.` |
| NEST | At capacity | Capacity turns `warn` ▲; FEED reads `FEED · NEST FULL`; DIG stays the move. |
| NEST | Goal met (latched) | `GOAL MET`; **> CONTINUE**; dipped conditions explained. |
| NEST | No next action (Phase 1 only) | No case: Phase 1 always has LAY EGG, Colony on always has DIG. `NEXT AFFORDABLE: <item> IN ~<time>` lives in the BUILD header. |
| NEST | Large colony | Dot cloud with ants moving on top; exact counts in the chamber labels and strip. |
| NEST | Phase 6 | The final goal meter (VC, antimatter, dark matter, GDD); when met, **> TRANSCEND** plays the ending. |
| NEST | After the ending | `THE SWARM IS EVERYWHERE NOW.`, then LOG → LEGACY opens with prestige offered (GDD E7). The victory is recorded. |
| WRKR | No free workers | `[+]` disabled with `no free workers`; reassigning still works. |
| BUILD | Nothing affordable | Cards show shortfalls; header `NEXT: <item> IN ~<time>`. |
| BUILD | Research running | Progress meter; cancel needs confirmation. |
| FRONT · WAR | No soldiers | Enemy card shown; **> FIGHT** disabled: `train soldiers first`. |
| FRONT · WAR | Training | Training meter and queue count; automation target if unlocked. |
| FRONT · WAR | Battle running | Round counter on the enemy card; the summary sheet opens at the end. |
| FRONT · MAP | Nothing discovered | All tiles `?`; one dim line: `SEND SCOUTS TO SEE.` |
| FRONT · MAP / STARS | 3 of 3 out | Primary action disabled: `3 of 3 out · back in 14m`. |
| FRONT · STARS | Entropy > 75% | Entropy meter in `warn`; event line. |
| Any | Costly ignore timed out | The outcome is written to the log and a toast shows it once. |
| Any | Event due during a reveal, the cinematic or the ending | Held until the overlay ends. |
| Any | Phase reveal | Full screen for at most 3.5 s; skippable (tap, Enter, Esc) after you've seen that reveal once. |
| LOG | First visit | Shows every event so far (never empty after Phase 1). |
| Settings | — | See Component Patterns → Settings. |

## Interaction Primitives

- **Tap** acts. **Hold** repeats buy, assign and lay at about 8/s, speeding up after 1 s `[ASSUMPTION: acceleration]`. Actions fire on pointer-up, so dragging off cancels them.
- **Swipe down** dismisses non-decision and peek sheets. There are no other gestures, and every swipe has a button equivalent.
- **Confirm** for irreversible actions: hold (default) or two taps (setting).
- **No undo.** Allocation is instant and freely reversible. Confirmation guards anything irreversible.
- **Desktop and keyboard:** a click is a tap. Hovering shows only what a tap would show, and it stays dismissible and hoverable (WCAG 1.4.13). Shortcuts, which can be switched off and remapped: **Space** triggers the primary action of the active tab (on desktop, the action in columns 2–3; to use NEST's own button, click it or focus it and press Enter), but only when focus is on the page or that button; **1–5** switch tabs; **P** pauses; **Esc** closes a non-decision sheet. Space as the primary action generalizes the GDD's "Space lays an egg". Today's Space-to-pause binding moves to P.
- **Banned:** ads, timed "claim" buttons, streaks, numeric badges, interstitials, and any mechanic that needs repeated tapping after Phase 1 (Pillar 3).

## HUD & Diegetic UI

- **Diegetic (the vector scene):** the nest is the colony. Chambers fill up, a starving colony thins, the map tiles are the territory, the star map is the fleet. This is the emotional readout.
- **Non-diegetic (the terminal):** the strip, meters, cards, sheets and tab bar. This is the exact readout, always in integers.
- **Always visible:** the resource strip, and the goal meter (full on NEST, condensed elsewhere).
- **Hidden during:** the title cinematic, phase reveals and the Transcendence ending.

## Game Feel & Juice

Calm and responsive. The juice is phosphor: glow, the cursor and scene motion.

| Trigger | Visual | Haptic | Sound (when on) |
|---|---|---|---|
| Lay egg | An egg appears beside the queen; `+1` types in next to EGG | Light tick | Soft key click |
| Hatch / mature | Egg → larva → a worker that walks into a chamber | none | Very soft, at most 1/s |
| Newly affordable | Card border glows for 2 s; `•` on the tab | none | none |
| Press / hold a buy | Button goes inverse on press and stays inverse until release; the value counts down; `+N` floats at most 8 per second | Light on press | Key click, at most 8 per second |
| Battle result | Summary sheet; the headline types in | Medium (win) / double light (loss) | Result tone |
| Decision event | Sheet rises; headline types in | Light | Two-tone chime |
| Phase change (after CONTINUE) | 3 s palette cross-fade; phase name; one line types in | Heavy, once | Phase tone |
| Camera pull-back | The scene eases out over 1 s | none | none |
| Transcendence ending | The colony breaks into characters, which scatter; the screen empties | One long | Fade to silence |

- **Flash rule:** no element changes luminance more than 3 times in any 1 s. An E1 test asserts this during a 2 s hold.
- A tap gets a visual response within 100 ms (GDD), before the state write lands.
- The colony wanders gently between check-ins, so the nest reads as alive.
- **Reduced motion** (OS setting or in-game toggle): no typing-in effects, wandering, camera easing or floating `+N`; a 300 ms palette fade instead of the 3 s cross-fade; the cinematic opens on its logo; the ending is a 1 s fade; the cursor is steady; CRT effects go OFF. Haptics and sound keep their own toggles.
- Haptics are an enhancement and never the only feedback.

## Accessibility Floor

Behavior only. Contrast and type sizes live in DESIGN.md.

- **Typed decoration is hidden from assistive tech:** `>`, `·`, `█`, brackets, box-drawing characters and text meters are `aria-hidden` (or CSS-generated). Meters are `role="progressbar"` with `aria-valuetext` (for example, "Workers 37 of 50"). Goal conditions are a list that reads "met" or "not met". Steppers have full names ("Add one gatherer"). Labels expose the full word ("Stone", not "STON"). Aligned rows use real list or table markup.
- **Typing effects are visual only:** the accessible node holds the full string from the start.
- **Live regions (polite):** goal met, phase entered, battle result, decision event arrived (the sheet takes focus), a costly ignore applied, starving, capacity reached, save failed, and the offline summary (focused on open). Resource values are not announced every tick.
- **Focus:** visible indicator (DESIGN.md). Order: strip → phase line and goal meter → nest summary → event lines → primary action → tab bar. On desktop: rail → column 1 → columns 2–3. Sheets are `role="dialog"` and `aria-modal`; focus moves to the headline, is trapped inside, and returns to the trigger on close. Decision sheets can't be closed with Esc, but their choices are always reachable. `scroll-padding-bottom` equals the primary zone plus the tab bar, so focused items are never hidden.
- **Nest scene:** a group labelled with its counts ("Nest: 37 workers, 5 eggs, 4 larvae"), with each chamber a labelled button.
- **Text size:** rem units, zoom never disabled, and reflow rules down to 320 px and 200% (DESIGN.md → Layout).
- **Color:** hue never carries meaning alone (DESIGN.md).
- **Targets:** at least 44×44 px, with at least 8 px between adjacent targets. Map tiles are 40 px with 2 px gaps; a tap only selects, and confirmation happens in the sheet.
- **Motion, blinking, flashing:** reduced motion, CRT effects and the flash rule (above). The cursor stops blinking after 5 s idle.
- **Timing:** decision timers can be doubled (×2) or turned off; unavoidable events have no timer; the hint shows on the first timed event; timers pause when the app is in the background.
- **Input alternatives:** two-tap confirm instead of hold; lay toggle instead of hold; ×MAX instead of hold-repeat; map pan buttons instead of dragging; shortcuts can be switched off and remapped.
- **Audio** is never the only channel for information.
- **One-handed:** see the thumb-reach rule in DESIGN.md → Layout & Spacing.

## Responsive & Platform

| Viewport | Layout |
|---|---|
| 320–359 px wide | See DESIGN.md → Layout & Spacing |
| 360–599 px | Single column, bottom tab bar, pinned primary zone |
| 600–1023 px | The same single column, centered at 600 px max `[ASSUMPTION: no tablet layout]` |
| ≥ 1024 px | Layout: DESIGN.md → Layout & Spacing. Behavior: picking NEST in the rail focuses column 1 and leaves columns 2–3 on the last tab (BUILD on first visit) `[ASSUMPTION]`. See [`mockups/key-desktop.html`](mockups/key-desktop.html) |
| Height < 560 px | See DESIGN.md → Layout & Spacing |
| Height < 480 px (landscape) | See DESIGN.md → Layout & Spacing |

- Safe-area insets are respected.
- **No notifications in the web build** (owner, 2026-11-21): a closed page cannot detect events. A later store build may schedule local notifications at predicted times (for example `NEST IS FULL.` and `THE NEST STOPPED GROWING.`); any such toggle starts off. Nothing in the game may depend on them.

## Inspiration & Anti-patterns

- **From A Dark Room:** the interface that starts as one button and reveals itself; terse text as the main storytelling channel.
- **From Universal Paperclips:** the terminal register; the goal as a visible horizon.
- **From real ant farms:** the cross-section nest that fills.
- **From Kittens Game:** allocation as the core screen, done with steppers instead of spreadsheet density.
- **Rejected:** Idle Ants / Pocket Ants loops (ads, claim timers, gacha, badge spam); tapping as a long-term verb; the prototype's 23 simultaneous panels; ASCII creatures (tried in Discovery, not readable enough); any preview of later phases.

## Key Flows

### Flow 1: Priya's first five minutes (first launch → Colony)

Priya is on a bus, phone in one hand, and has never played an idle game.

1. She opens the game. The title cinematic plays: a vector queen lands on amber grass, tunnels down, and the first chamber opens. `ONE EGG.` The colony swarms through new chambers. `ONE QUEEN.` The soil clears and the ants march up into **THE SWARM**. (See `mockups/title-cinematic.html`.)
2. **[ TAP TO WAKE THE QUEEN ]**. She taps. `A QUEEN, ALONE.` The brood chamber, drawn at 2×. A coach mark points at **> LAY EGG**.
3. She taps; an egg appears beside the queen, with a light tick. She finds hold-to-repeat, and eggs pile up and curl into larvae.
4. The goal meter: `NEXT: 10 WORKERS` · `workers 1/10 need`. A Click Power card appears under the event lines; she buys it.
5. FOOD dips: `warn` ▼. Unassigned workers gather at half rate (GDD).
6. **Climax:** `workers 10/10 met`. **> CONTINUE**. She taps. Amber cross-fades to phosphor green, `COLONY` types in, then `THE FIRST WORKER STIRS.` The tab bar appears, and WRKR has `•`.
7. She opens WRKR, taps GATHER `[+]` four times, and gets off the bus.

*Failure path:* she backgrounds the app mid-cinematic. The flag is set when the cinematic starts, so it won't replay; she lands in the brood chamber, and "replay intro" is in settings.

### Flow 2: Dev's 45-second lunch check-in (Phase 2 → 3)

Dev is on day 2 of his run and checks in between meetings, resuming the app from the background, where he left it.

1. He switches to the app. The resume path runs catch-up, and the sheet reads `YOU WERE GONE 4H 10M · 50%`, with gains listed by glyph and one `warn` line: `UPKEEP OUTRAN FOOD FOR 20M.`
2. He closes the sheet. BUILD has `•`: he opens it and buys **WAREHOUSE LV.3**. (Changed 2026-11-22: the sheet no longer suggests a move.)
3. WRKR has `•`. He moves 2 from DIG to GATHER.
4. **Climax:** NEST's goal meter shows `workers 50/50 met · guards 0/1 need`. He assigns one GUARD. `GOAL MET`, and **> CONTINUE** appears. He saves the reveal for tonight and locks the phone at 45 s.
5. That evening, starvation has dropped him to 48 workers. The meter reads `GOAL MET · workers 48 now, reached 50 at 13:02`. CONTINUE is still there, and he knows why.

*Failure path:* nothing is affordable → WRKR suggests an allocation change, or BUILD reads `NEXT AFFORDABLE: WAREHOUSE IN ~2H`, and DIG is always there. The summary is never empty (E2 done-when). *Note (2026-11-23):* in the new session shape this check-in is 90–120 s and comes after the first week; the flow's numbers predate the rescale.

### Flow 3: Priya loses her first fight (Phase 3)

1. FRONT → WAR. The enemy card: `ARMORED BEETLE · THICK SHELL`, the first enemy drawn. She has 12 soldiers and Potent Venom.
2. **> FIGHT**. A round counter ticks.
3. `DEFEAT` · `−5 SOLDIERS ▼` · `THEIR SHELLS TURNED YOUR VENOM.`, with **> CHANGE → MANDIBLES**.
4. She follows it and buys Reinforced Mandibles.
5. She sets `KEEP 12 IN TRAINING` with `[AUTO]` on.
6. **Climax:** the rematch. `VICTORY` · `+12 CHITIN` · `YOUR MANDIBLES CRACKED THEIR SHELLS.` The meter reads `wins 3/5 need`.

*Failure path:* Mandibles are unaffordable → the card shows `needs 8 more CHTN`, and the summary's second line suggests a cheaper fix (equipment) if one exists.

### Flow 4: Beetles at the door (decision ignore policies)

1. A sheet rises: `BEETLE SIGHTING`, with **> SEND GUARDS** (−2 GUARD, risk) and **> SEAL THE ENTRANCE** (−1 h of gathering). A 30 s timer, then `IGNORE: THE BEETLES TAKE 3 FORAGERS`. A one-time hint: `TIMERS CAN BE SLOWED IN SETTINGS`.
2. Priya's bus arrives. She locks the phone with 12 s left, and the timer pauses.
3. Back home she opens the app. The offline summary comes first, then the beetle sheet returns with 12 s left. She picks SEAL.
4. Later, `OVERCROWDING.` arrives with no timer and no IGNORE line: EXPAND (stone) or EXILE 10 workers. She must choose.
5. **Climax:** the outcome types into the log; the entrance is drawn sealed and the gatherers walk back inside.

*Failure path:* she lets a costly event time out. `THE BEETLES TOOK 3 FORAGERS.` goes into the log, a toast shows it once, and the colony visibly loses 3 ants.

### Flow 5: Dev sets up the colony to run itself (Phase 2–3)

1. In BUILD, Dev starts Basic Incubation research: a progress meter and `12m left`.
2. He starts a second chain by mistake. Holding `CANCEL (50 % BACK)` fills the ring, and the refund is shown before he lets go.
3. Incubation completes. A training automation target appears in WAR: he sets `KEEP 20 IN TRAINING` and `[AUTO]`.
4. **Climax:** he closes the app. Next morning the offline summary shows soldiers kept at 20 overnight, with upkeep paid, because offline runs the same targets (GDD).

*Failure path:* food runs short overnight. The target shows `holding at 14 · food short` in `warn`, and WRKR suggests the allocation fix.

### Flow 6: Nadia's first expedition (Phase 4, post-MVP)

1. FRONT → MAP is new. All tiles show `?`, and `SEND SCOUTS TO SEE.`
2. She recruits 2 scouts (Barracks Lv.1) and taps a `?` next to home. It's selected in inverse video, and a peek sheet offers SCOUT.
3. She taps a different tile by mistake. The sheet retargets; nothing is committed.
4. The scouts return: a Meadow and an Enemy Nest (mound, `warn`). She claims the Meadow from its peek sheet.
5. **Climax:** an expedition to the Enemy Nest brings back a partial success: `−1 WARRIOR · +40 SILK`, with space drops (a 10% chance, GDD) noted when they occur.

*Failure path:* all three expedition slots are out → **> SEND EXPEDITION** is disabled with `3 of 3 out · back in 14m`; a failed expedition returns a result sheet with losses and no loot.

### Flow 7: Marco transcends and prestiges (post-MVP)

1. LOG → LEGACY first appeared weeks ago, when the GDD's prestige condition was met. Marco chose to push on.
2. Phase 6. NEST shows the final goal meter. Once it's met, **> TRANSCEND** appears.
3. **Climax:** the ending plays. The colony breaks into characters and they scatter. `THE SWARM IS EVERYWHERE NOW.` The victory is recorded.
4. LOG → LEGACY opens with prestige offered. He holds **> PRESTIGE**, and amber returns: `A QUEEN, AGAIN.` There's no cinematic.

*Failure path:* he releases the hold early. The ring drains and nothing happens. With two-tap mode on, the armed state times out after 5 s.

### Flow 8: Sam's evening on desktop (secondary)

1. Sam opens the game in a laptop tab. NEST stays in column 1 and BUILD in columns 2–3.
2. He uses 1–5 to switch tabs and Space for the primary action. Space on a focused stepper presses that stepper, not the primary action.
3. A decision dialog appears centered. Focus moves to its headline, and he answers with the keyboard.
4. **Climax:** he presses P to pause while making dinner and comes back to an unchanged colony.

*Failure path:* he has switched keyboard shortcuts off in settings; Space and P do nothing, and he uses the rail and buttons instead. If he switches to another browser tab or closes the laptop instead, the pause ends: on return the time away is offline time and, after 60 s or more, the offline summary opens.

## Implementation notes (non-normative)

These were found while reviewing the spec against the current code (`main @ 24da5b1`). They feed `gds-game-architecture` and story writing. They aren't part of the UX contract. Full detail: `review-code-feasibility.md`.

| Spec | Current code | Story note |
|---|---|---|
| CONTINUE with latch | `PhaseStateMachine.tick` auto-fires the first matching guard | Split into a pure check plus a commit on CONTINUE; persist the latch in the save. First remove the Colony → Expansion transition (GDD E3); about 7 E2E specs and 4 unit files assume auto-transition |
| Goal meter per condition | Guards are single booleans | Decompose each guard into named conditions **inside `transitions.ts`**, so the UI never copies thresholds |
| Resume from background | No `visibilitychange` handling; `Ticker` caps frames at 1 s | Add a resume path running offline catch-up and the summary (E2) |
| Decision lifecycle | 30 s wall-clock auto-dismiss; spawn timer fires right after load; `show()` replaces the open event | Add an ignore-policy field, a persisted open event, a session-based spawn timer and a one-slot queue |
| Map tile select-only | `UIRoot` claims a tile on click | Move claiming into the peek sheet |
| Space = primary, P = pause | Space toggles pause | Rebind. Pause stays in memory only (no save field); hiding the app ends it |
| Phase reveal skippable | Overlay has `pointer-events: none` | Make it input-blocking and skippable |
| Corrupt save sheet | Recovery is silent | Show the sheet |
| LOG persisted | Event log lives in component memory | Persist it with the save |
| Settings | None; sound defaults on | New settings store; sound off by default |
| First-launch flag | `OnboardingManager` already uses its own key | Reuse the pattern; no save migration |
| BUILD and strip in Phase 2 | Buildings unlock in Expansion; wood, stone and nectar come only from territory | Already covered by GDD E3 (Phase 2 worker-role sources) |

## Mockups

References only. **DESIGN.md and EXPERIENCE.md win on any conflict**, and mock colors and sizes are illustrative: the DESIGN.md tokens are normative.

- [`mockups/title-cinematic.html`](mockups/title-cinematic.html): first-launch cinematic (see Flow 1).
- [`mockups/terminal-variants.html`](mockups/terminal-variants.html): the top row is the reference for the vector nest scene (small and large colony) and the vector map. Its inline tile panel is superseded by the peek sheet, and its ASCII-nest row is superseded.
- [`mockups/glyphs.html`](mockups/glyphs.html): the glyph set and the strip in the chosen "glyph + label" layout. Its `WRK` label should read `WRKR`.
- [`mockups/key-nest.html`](mockups/key-nest.html): NEST in Phase 1 (no tab bar, Click Power card) and Phase 2 with the goal latched after a dip, at 360×640 and 360×512 (Goal meter, Click Power card, State Patterns → NEST, Flows 1–2).
- [`mockups/key-wrkr-build.html`](mockups/key-wrkr-build.html): WRKR with instant steppers, upkeep and an automation row; BUILD with the highlighted card, a disabled card and running research (Stepper / role row, Automation target row, Research card, Flow 5).
- [`mockups/key-sheets.html`](mockups/key-sheets.html): offline summary, costly-to-ignore decision event, battle summary (Offline summary, Decision event, Battle summary, Flows 2–4).
- [`mockups/key-map.html`](mockups/key-map.html): FRONT · MAP with a selected tile and its peek sheet, and with nothing selected (Map tile, Flow 6).
- [`mockups/key-desktop.html`](mockups/key-desktop.html): desktop at 1280×800, with the left rail, NEST in column 1, BUILD in columns 2–3, and a decision dialog with keyboard focus (Responsive & Platform, Interaction Primitives, Accessibility Floor → Focus, Flow 8).
