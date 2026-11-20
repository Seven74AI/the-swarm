---
title: "THE SWARM — EXPERIENCE"
status: draft
created: 2026-11-20
updated: 2026-11-20
form_factor: mobile portrait touch (primary, 360×640 min); desktop browser ≥1024 px (secondary)
sources:
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/gdd.md
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/epics.md
  - _bmad-output/planning-artifacts/briefs/brief-the-swarm-2026-11-20/brief.md
baseline_code: "Seven74AI/the-swarm main @ 24da5b1"
---

# EXPERIENCE.md — THE SWARM

> Constraints inherited from the GDD (*Controls and Input*, E1, E2) are referenced, not restated. Visual identity lives in DESIGN.md. Owner decisions from Discovery are recorded in `.decision-log.md`. The remaining `[ASSUMPTION]` tags are values the owner hasn't confirmed.

## Foundation

- **Surfaces:** phone, portrait, one-handed touch (primary). Desktop browser with mouse and keyboard (secondary): the same screens in more columns.
- **Engine / UI system:** none committed. The prototype uses vanilla DOM panels on a single `gameState` signal, and `gds-game-architecture` decides the stack. Two rendering needs follow from DESIGN.md: a **monospace text UI** laid out on a 36-column grid, and a **vector scene layer** (SVG or canvas; architecture's call) for the nest, map, star map, the title cinematic and the phase reveals.
- **Session shape:** 30–90 s check-ins about 6 times a day. Every surface must work with under 10 s of attention and survive being dropped mid-action.

## Information Architecture

### Tabs

At most 5 tabs, revealed by phase. A phase adds tabs or segments, never a sixth tab.

| Tab (label) | Appears | Primary action (thumb zone) | Holds |
|---|---|---|---|
| **NEST** (home) | Phase 1 | Phase 1: **> LAY EGG**. Later: **the single most useful next action** (see Component Patterns → Primary action). When a guard is met: **> CONTINUE** | Vector nest scene, phase line, guard meter, newest 3 event lines. Phase 6: the Transcendence conversion and the ending |
| **WRKR** (Workers) | Phase 2 | The single most useful reallocation when one exists (e.g. **> MOVE 4 TO GATHER**); otherwise none `[ASSUMPTION]` | Role rows (Gather, Forage, Tend, Dig, Guard, Research), upkeep readout, automation targets |
| **BUILD** | Phase 2 | **> BUY** on the highlighted card | Buildings, research trees, resource converter |
| **FRONT** (Frontier) | Phase 3 | Phase 3: **> FIGHT**. Phase 4 Map: **> SEND EXPEDITION**. Phase 5 Stars: **> LAUNCH** | A segment row that grows: `[WAR]` → `WAR · MAP` → `WAR · MAP · STARS`. Opens on the newest segment |
| **LOG** (Chronicle) | Phase 2 | none (a reading surface) | Full event log, lifetime stats, settings. After prestige unlocks: a **LEGACY** section (prestige, Legacy tree) |

- **Phase 1 has no tab bar.** NEST is the whole game. Entering Colony reveals NEST · WRKR · BUILD · LOG at once, and FRONT arrives with Combat.
- **Global, outside the tabs:** the resource strip (tap opens the full resource sheet, which has the settings gear, so settings are reachable in Phase 1); the decision-event sheet; the offline-summary sheet; phase reveals; the title cinematic (first launch only).

### Panel consolidation (prototype → tab)

Every prototype panel and component has a home:

| Prototype surface | Destination |
|---|---|
| ResourcePanel, FoodDisplay (rate) | Resource strip and resource sheet |
| PhaseIndicator | Phase line and guard meter (NEST); a condensed meter under the strip on other tabs |
| ClickButton | NEST primary action |
| EventLog | NEST (newest 3) and LOG (full) |
| WorkerAssignment, FoodDisplay (upkeep), AutoProductionPanel | WRKR |
| BuildingPanel, ResearchPanel, TechTreePanel, ResourceConverterPanel | BUILD |
| SoldierPanel, BattlePanel, CombatLogPanel, MutationPanel | FRONT → WAR |
| MapPanel, ExpeditionPanel | FRONT → MAP |
| SpaceshipPanel, StarmapPanel, ExplorationPanel, CosmicPanel (entropy) | FRONT → STARS |
| PrestigePanel, PrestigeTreePanel | LOG → LEGACY |
| TranscendencePanel | NEST (Phase 6) |
| DecisionPopup, OfflineSummaryPopup | Bottom sheets |
| OnboardingTooltip | Coach marks |
| NumberDisplay, ProgressBar | `value` text, text meter |

### What the NEST shows, top to bottom

1. What changed (strip deltas).
2. How close the next phase is (guard meter).
3. The colony itself (nest scene).
4. What just happened (event lines).
5. What to do (primary action).

### Navigation rules

- Nothing is deeper than tab → segment → sheet. No pushed sub-pages.
- Sheets never stack. A decision event that arrives while another sheet is open waits, and a `•` marker shows in the strip until it can open.
- Each tab keeps its scroll position and segment for the session.

## Voice and Tone

The colony speaks in short, present-tense, upper-case terminal lines. The interface speaks plainly. Neither uses exclamation marks.

| Context | Do | Don't |
|---|---|---|
| Narrative beat | `THE FIRST WORKER STIRS.` | "Congratulations! You unlocked Colony!" |
| Event line | `BEETLES TOOK 3 FORAGERS.` | "Event: Beetle Sighting resolved (−3 workers)" |
| Guard meter | `COMBAT AT 50 WORKERS + 1 GUARD` · `workers 37/50` | "Progress: 74%" alone |
| Shortfall | `needs 60 more △` (glyph inline) | "Insufficient resources" |
| Battle summary | `DEFEAT` · `THEIR SHELLS TURNED YOUR VENOM.` | "You lost." |
| Decision ignore line | `IGNORE: THE BEETLES TAKE 3 FORAGERS` | A silent timeout |
| Offline summary | `YOU WERE GONE 6H 12M. THE NEST KEPT WORKING.` | "Welcome back! Collect your rewards!" |
| Offline cap | `THE NEST STOPPED GROWING AFTER 12H.` | "Offline limit reached!" |
| Title | `ONE EGG. ONE QUEEN. ONE SWARM.` | Anything that names later phases |

## Component Patterns

Behaviour only. Visual specs are in DESIGN.md → Components.

| Component | Behavior |
|---|---|
| **Resource strip** | Up to 5 phase-relevant resources, each a glyph and a 4-letter label (P1: EGG, LRVA, WRKR, FOOD; P2: FOOD, WRKR, WOOD, STON, NECT; P3 rotates in the combat drops) `[ASSUMPTION: per-phase sets]`. On screen, values refresh at most 4 times a second whatever the tick rate. Tapping opens the resource sheet: every unlocked resource with its rate, cap and source, plus the settings gear. |
| **Tab bar** | Tap to switch; tapping the active tab scrolls it to the top. A `•` appears when something on that tab became affordable since your last visit, and clears when you visit. |
| **Primary action** | Always the single most important verb on the current tab, pinned in the thumb zone. Holding repeats it at about 8/s (GDD). On NEST after Phase 1, the action is chosen in this order: **(1)** CONTINUE if the guard is met; **(2)** an allocation fix if food or capacity is critical; **(3)** an affordable upgrade on the critical path; **(4)** a guard-progress action. The label names the action and its target ("> BUY WAREHOUSE LV.3"). |
| **Stepper / role row** | Every −/+ **applies immediately**, as in today's build (owner decision). The active multiplier sets the step: ×1, ×10, or ×MAX (as many as are available, respecting capacity). Holding repeats. Values never go below 0 or above what's available. The upkeep readout at the top of WRKR updates live. |
| **Card** | Only the card's button is tappable, not the whole card, which prevents mis-taps while scrolling. An unaffordable card shows its shortfall in `warn`. The first time a card becomes affordable it highlights for 2 s. |
| **Meter** | The label states the goal in words and numbers. Every phase has a guard meter (GDD). Guards with several conditions show one row per condition, each with ✓ or ✗. |
| **Bottom sheet** | Non-decision sheets close with a swipe down or a tap on the scrim. Decision sheets close only by choice or timeout. |
| **Decision event** | Fires only while the game is open, every 2–3 min (GDD). The sheet shows the situation, 2 choices with their visible cost or risk, and **its ignore policy**, which is one of three per event (owner decision): **(1) free to ignore**: timer meter, `IGNORE: NOTHING HAPPENS`; **(2) costly to ignore**: timer meter, `IGNORE: <stated outcome>`, and the outcome applies on timeout; **(3) unavoidable**: no timer and no dismiss, you must choose. The timer pauses while the app is in the background (GDD). Settings can double or disable timers for types 1–2. Which event gets which policy is E4 content. |
| **Offline summary** | Shown on resume after ≥ 1 min away `[ASSUMPTION]`. Elapsed time, efficiency %, gains and losses per resource (with glyphs), whether the cap was reached, and **one next-action button** that opens the relevant tab with that card highlighted. If a guard was met while you were away, the next action is **> CONTINUE**. |
| **Phase change** | When a guard is met, the phase **does not change on its own** (owner decision). NEST's primary action becomes **> CONTINUE**, with a `•` on NEST, and tapping it plays the phase reveal. Nothing about the next phase shows before the tap. |
| **Battle summary** | After each battle: the result, losses, drops, one causal line ("THEIR ARMOR BEAT YOUR VENOM."), and a **> CHANGE → <card>** button that opens the relevant mutation or equipment card. |
| **Enemy card** | Shows the enemy type and its trait before you commit (GDD Combat interest bar). **> FIGHT** is the primary action. |
| **Event line** | Newest first. Tapping a line that points at something ("WAREHOUSE FULL.") jumps to it. |
| **Nest scene** | Watch-only, except that tapping a chamber opens a small sheet with that chamber's counts. The drawn ants track the real counts up to the cloud threshold. |
| **Map tile** | Tap selects a tile (highlight stroke) and opens a **tile sheet** with terrain, yield, risk and actions (SCOUT / CLAIM / EXPEDITION). The grid itself is 8 × 40 px and fits without zoom. Pan only if a later map grows. |
| **Star map** | Tap a planet to open its sheet: resource, ships there, exploration progress and actions. |
| **Toast** | One line for 2 s that replaces any earlier toast. Never used for anything you need to act on. |
| **Coach mark** | Points at one element with one line of text, once per concept. Dismissed by doing the thing or by tapping anywhere. |

## State Patterns

| Surface | State | Treatment |
|---|---|---|
| App | **First launch ever** | The **title cinematic** plays (about 11 s, Phase 1 amber only). Tap to skip. It ends on the logo and **[ TAP TO WAKE THE QUEEN ]**, then `A QUEEN, ALONE.`, then the brood chamber, then a coach mark on LAY EGG. |
| App | Later launches | Straight to NEST. No title screen. |
| App | Resume after ≥ 1 min | The offline-summary sheet over NEST. |
| App | Resume after < 1 min | No sheet; the strip deltas flash once. |
| App | Corrupt save or failed migration | A sheet: `THIS SAVE COULDN'T BE READ.`, with LOAD BACKUP (the rotating backup, GDD) or START OVER. Never a silent reset. |
| NEST | Phase 1, nothing hatched yet | Empty chamber with the queen; one dim line: `EGGS HATCH INTO LARVAE.` |
| NEST | Starving | FOOD turns `warn` with ▼; an event line appears; the primary action becomes the allocation fix. The drawn colony visibly thins as workers are lost. |
| NEST | At nest capacity | The capacity value turns `warn` ▲; the primary action points at DIG or the Warehouse. |
| NEST | Guard met | Meter full with ✓ on every condition; primary action **> CONTINUE**. |
| NEST | Large colony | The drawn workers become a dot cloud; the count stays exact in the chamber label and the strip. |
| WRKR | No free workers | `[+]` disabled with `no free workers`; reassigning still works. |
| BUILD | Nothing affordable | Cards show their shortfalls; the header reads `NEXT: WAREHOUSE IN ~2H` (time to afford). |
| FRONT · WAR | Battle running | The enemy card shows a round counter; the event log keeps going; the summary sheet opens at the end. |
| FRONT · MAP/STARS | 3 of 3 out | Primary action disabled; cost line reads `3 of 3 out · back in 14m`. |
| Any | Decision pending behind another sheet | `•` marker in the strip until it can open. |
| Any | Phase reveal | Full screen; input blocked for ≤ 3.5 s; tap to skip after you've seen that reveal once. |
| LOG → LEGACY | Prestige available | The section appears; prestige uses hold-to-confirm. |
| Settings | — | Sound (off by default), haptics, reduced motion, **CRT effects** (glow and scanlines), decision timers (normal / ×2 / off), notifications (off by default), **replay intro**, export and import save `[ASSUMPTION: save export]`. Text size follows the OS. |

## Interaction Primitives

- **Tap** acts. **Hold** repeats buy, assign and lay at about 8/s, speeding up after 1 s `[ASSUMPTION: acceleration]`.
- **Swipe down** dismisses non-decision sheets. There are no other swipe gestures: no swiping between tabs, because it would fight map panning.
- **Hold to confirm (1 s, a filling ring)** for irreversible actions: prestige, cancelling research (50 % refund), dismantling.
- **No undo.** Allocation is instant and freely reversible with the steppers. Confirmation is the safeguard for anything irreversible.
- **Desktop:** a click is a tap. Hovering shows what a tap would show, never more. Space triggers the primary action, 1–5 switch tabs, Esc dismisses a non-decision sheet `[ASSUMPTION: shortcut set]`.
- **Banned:** ads, timed "claim" buttons, streaks, numeric badges, interstitials, and any mechanic that needs repeated tapping after Phase 1 (Pillar 3).

## HUD & Diegetic UI

- **Diegetic (the vector scene):** the nest is the colony. Chambers fill up, a starving colony visibly thins, the map tiles are the territory, the star map is the fleet. This is the emotional readout.
- **Non-diegetic (the terminal):** the strip, meters, cards, sheets and tab bar. This is the exact readout, always in integers.
- **Always visible:** the resource strip, and the guard meter (full on NEST, condensed elsewhere). Nothing that tells you you're losing population is ever hidden.
- **Hidden during:** the title cinematic, phase reveals and the Transcendence ending.

## Game Feel & Juice

Calm and responsive. The juice is phosphor: glow, the cursor and scene motion. No bounce, no confetti.

| Trigger | Visual | Haptic | Sound (when on) |
|---|---|---|---|
| Lay egg | An egg appears beside the queen in the scene; `+1` types in briefly next to EGG | Light tick | Soft key click |
| Hatch / mature | The egg becomes a larva, then a worker that walks off into a chamber | none | Very soft, at most 1/s |
| Newly affordable | Card border glows for 2 s; `•` on the tab | none | none |
| Buy | Button inverts (accent fill) for 100 ms; the value counts down | Light | Key click |
| Battle result | Summary sheet; DEFEAT or VICTORY types in letter by letter | Medium (win) / double light (loss) | Result tone |
| Decision event | Sheet rises; headline types in | Light | Two-tone chime |
| Phase transition (after CONTINUE) | 3 s palette cross-fade; phase name in `display`; one line types in | Heavy, once | Phase tone |
| Transcendence ending | The vector colony breaks into characters, which scatter; the screen empties | One long | Fade to silence |

- A tap gets a visual response within 100 ms (GDD), before the state write lands.
- The colony keeps moving gently (ants wander in their chambers) so the nest reads as alive between check-ins.
- **Reduced motion:** no typing-in effects, no scene wandering, an instant palette swap with a 300 ms fade, the cinematic opens on its logo, and glow and scanlines are off. Haptics and sound keep their own toggles.
- During hold-repeat, floating `+N` text is limited to 8 per second.

## Accessibility Floor

Behaviour only. Contrast and type sizes live in DESIGN.md.

- **Screen readers:** every control is labelled with its role, state and cost ("Buy Warehouse level 3, costs 400 food and 40 wood, unavailable, needs 40 wood"). Glyphs carry text alternatives. The nest scene is one image labelled with its counts ("Nest: 37 workers, 5 eggs, 4 larvae"). Resource values are not announced every tick; threshold events (capacity reached, starving, guard met) are announced through a polite live region.
- **Text size:** follows the OS up to 200 % without clipping controls. If the strip runs out of room, labels drop first and glyphs stay.
- **Colour:** hue never carries meaning alone (DESIGN.md). The single-colour design already assumes no colour discrimination inside a phase.
- **Targets:** at least 44×44 pt (GDD), with at least 8 px between adjacent targets. Map tiles are 40 px with 1 px gaps, and the selection sheet confirms the action, so a mis-tap only selects and never commits.
- **Motion and flashing:** respects the OS reduced-motion setting, the in-game toggle and the CRT effects toggle. Nothing flashes faster than the 1 s cursor blink.
- **Timing:** decision timers can be set to ×2 or off. Unavoidable events have no timer by design. The hold-to-confirm duration is adjustable.
- **Hold alternatives:** every hold-repeat has a ×MAX equivalent.
- **Audio:** never the only channel for any information.
- **One-handed:** every Phase 1–3 action is reachable in the bottom 40 % (E1 done-when).

## Responsive & Platform

| Width | Layout |
|---|---|
| 360–599 px | Single column, bottom tab bar, pinned primary action |
| 600–1023 px | The same single column, centred at 600 px max `[ASSUMPTION: no tablet layout]` |
| ≥ 1024 px | Left-rail tabs; NEST always in column 1; active tab in columns 2–3; sheets become centred dialogs (max 480 px); 36-column rule per column |

- Safe-area insets are respected at the top and bottom.
- Phone landscape is not supported in v1; content stays portrait and centred `[ASSUMPTION]`.
- Opt-in notifications (GDD): `NEST IS FULL.` and `THE NEST STOPPED GROWING.` Architecture decides how they're delivered.

## Inspiration & Anti-patterns

- **From A Dark Room:** the interface that starts as one button and reveals itself; terse text as the main storytelling channel.
- **From Universal Paperclips:** the terminal register; the scale shift that redraws the screen; the guard as a visible horizon.
- **From real ant farms:** the cross-section nest, with soil, tunnels and chambers that fill.
- **From Kittens Game:** allocation as the core screen, done with steppers instead of spreadsheet density.
- **Rejected:** the Idle Ants / Pocket Ants loops (ads, claim timers, gacha, badge spam); Cookie Clicker-style tapping as a long-term verb; the prototype's 23 simultaneous panels; ASCII creatures (tried in Discovery and rejected as not readable enough); any preview of later phases before they're reached.

## Key Flows

### Flow 1: Priya's first five minutes (first launch → Colony)

Priya is on a bus, phone in one hand, and has never played an idle game.

1. She opens the game. Darkness, then a line of grass in amber. A vector queen drops onto the surface and tunnels down, the tunnel carving itself behind her, and the first chamber opens. `ONE EGG.` An egg appears. New chambers branch off, the colony swarms, the counter races. `ONE QUEEN.`
2. The soil clears and the ants march up and lock into **THE SWARM**. `ONE EGG. ONE QUEEN. ONE SWARM.` **[ TAP TO WAKE THE QUEEN ]** blinks. She taps.
3. `A QUEEN, ALONE.` The brood chamber, with one queen. A coach mark points at **> LAY EGG**. She taps, an egg appears beside the queen, and there's a light haptic tick.
4. She finds hold-to-repeat. Eggs pile up and curl into larvae. The guard meter appears: `COLONY AT 10 WORKERS` · `workers 1/10`.
5. FOOD dips, and the strip turns it `warn` ▼. The unassigned workers gather on their own at half rate (GDD).
6. **Climax:** `workers 10/10 ✓`. The button changes to **> CONTINUE**. She taps. Amber cross-fades to phosphor green, `COLONY` types in, then `THE FIRST WORKER STIRS.` The tab bar appears with NEST · WRKR · BUILD · LOG, and WRKR has a `•`.
7. She opens WRKR, taps GATHER `[+]` four times (each one applies immediately), and gets off the bus.

Failure path: she backgrounds the app mid-cinematic. On the next launch it doesn't replay; she lands on the brood chamber, and "replay intro" is in settings.

### Flow 2: Dev's 45-second lunch check-in (Phase 2 → 3)

1. Dev opens the app. The sheet reads `YOU WERE GONE 4H 10M · 50%`, with gains listed with glyphs and one `warn` line: `UPKEEP OUTRAN FOOD FOR 20M.`
2. The sheet's one next action is **> BUY WAREHOUSE LV.3**. He taps it; BUILD opens with that card highlighted.
3. He taps **> BUY**. The button inverts and a toast reads `WAREHOUSE LV.3`.
4. WRKR has a `•`. He moves 2 from DIG to GATHER with the steppers.
5. **Climax:** back on NEST the guard meter jumps: `workers 50/50 ✓ · guard ✗`. He assigns one GUARD. Both conditions turn ✓ and the button changes to **> CONTINUE**. He decides to watch the reveal tonight and locks the phone at 45 s. The CONTINUE waits for him.

Failure path: if nothing is affordable, the sheet's action is an allocation change and BUILD shows `NEXT: WAREHOUSE IN ~2H`. The summary is never empty (E2 done-when).

### Flow 3: Priya loses her first fight (Phase 3)

1. FRONT → WAR. The enemy card reads `ARMORED BEETLE · THICK SHELL`, and it's the first enemy drawn in vector. She has 12 soldiers and the Potent Venom mutation.
2. She taps **> FIGHT**. A round counter ticks while she reads the log.
3. The summary sheet reads `DEFEAT` · `−5 SOLDIERS ▼` · `THEIR SHELLS TURNED YOUR VENOM.` with **> CHANGE → MANDIBLES**.
4. She follows it. The Reinforced Mandibles card shows its chitin cost covered, and she buys it.
5. She trains 5 soldiers back; the cost line shows the workers they will use.
6. **Climax:** the rematch. `VICTORY` · `+12 CHITIN ◇` · `YOUR MANDIBLES CRACKED THEIR SHELLS.` The guard meter's `wins` condition ticks to 3/5.

### Flow 4: Beetles at the door (decision event policies)

1. Mid-check-in, a sheet rises: `BEETLE SIGHTING` with **> SEND GUARDS** (−2 guards, risk) and **> SEAL THE ENTRANCE** (−1 h of gathering), a 30 s timer meter, and `IGNORE: THE BEETLES TAKE 3 FORAGERS`.
2. Priya reads the ignore line and realises that doing nothing is also a choice. She picks SEAL.
3. Later, `OVERCROWDING!` appears with no timer and no IGNORE line. She has to choose between EXPAND (stone) and EXILE 10 workers.
4. **Climax:** the outcome types into the log. The nest scene shows the entrance sealed and the gatherers back inside.

### Flow 5: Marco prestiges for the first time (post-MVP)

1. Marco has finished the ending: the colony broke into characters and they scattered, leaving `THE SWARM IS EVERYWHERE NOW.` in an empty white-on-black screen.
2. LOG → LEGACY is now there. It shows the LP he would earn and what resets: everything except LP, Legacy upgrades, lifetime stats and the victory record (GDD).
3. He holds **> PRESTIGE** for 1 s while the ring fills.
4. **Climax:** amber returns. `A QUEEN, AGAIN.` No cinematic; it plays only on first launch. The victory record sits in LOG as a quiet line.

### Flow 6: Sam's long desktop session (secondary)

Sam keeps the game open in a laptop tab all evening. NEST stays in column 1, with the scene wider. He uses 1–5 to switch tabs and Space for the primary action. Decision events appear as centred dialogs. Nothing on desktop shows information that mobile lacks.

## Implementation notes from Discovery (code vs. this spec)

| Spec | Current code (`main @ 24da5b1`) | Consequence |
|---|---|---|
| Phase change waits for **> CONTINUE** | `PhaseStateMachine.tick` fires the first matching guard every tick | Needs a story. E2E seeds that rely on automatic transition must change. Guards stay in `transitions.ts`. |
| Per-event ignore policy; timer pauses in the background | `DecisionPopup` auto-dismisses after 30 s with a wall-clock `setTimeout`, with no consequence | An event-data field plus UI work; the background pause is already an E1 requirement. |
| Allocation applies instantly | Already instant (`WorkerAssignment` writes on click) | No change. |
| Vector scene layer and 36-column mono UI | DOM panels, emoji icons, Courier | E1 and E8 scope; the rendering approach is architecture's call. |

## Mockups

These are references, not specs. Where a mock and this spine disagree, the spine wins.

- [`mockups/title-cinematic.html`](mockups/title-cinematic.html): the first-launch cinematic (vector scene, terminal text, Phase 1 only).
- [`mockups/terminal-variants.html`](mockups/terminal-variants.html): the top row ("softer hybrid") is the reference for the vector nest at small and large colony sizes, and for the vector map with its tile panel. The ASCII-nest row and the inline tile panel are superseded: tiles open a sheet.
- [`mockups/glyphs.html`](mockups/glyphs.html): the glyph set and the strip in the chosen "glyph + label" layout (option 2).
