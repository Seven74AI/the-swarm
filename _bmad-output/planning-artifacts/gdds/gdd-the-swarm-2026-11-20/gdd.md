---
title: "THE SWARM - Game Design Document"
game_type: idle-incremental
platforms: ["mobile (portrait, touch) - primary; distribution TBD in architecture", "desktop browser - secondary"]
status: final
created: 2026-11-20
updated: 2026-11-20
inputs:
  - _bmad-output/planning-artifacts/briefs/brief-the-swarm-2026-11-20/brief.md
baseline_code: "Seven74AI/the-swarm main @ 0b0b364"
---

# THE SWARM - Game Design Document

**Author:** Seven74
**Game Type:** Idle/Incremental
**Target Platform(s):** Mobile first (portrait, touch); desktop browser second

> **Reading this document.** Numbers marked *baseline* are the values in the current build (main @ 0b0b364), recorded so architecture and epics start from reality. They are not commitments: the pacing pass (Epic 3) re-tunes them against the targets in *Progression and Balance*. Targets are design intent. Source code stays authoritative for current behavior; phase guards live only in `src/phases/transitions.ts`.

---

## Executive Summary

### Core Concept

You are the queen whose single egg becomes a swarm big enough to swallow the universe. THE SWARM is a mobile-first incremental game. Each of its six phases (nest, colony, battlefield, territory, space, transcendence) changes *what* the player manages, not only how big the numbers get. Every resource is a countable integer, growth always has a physical cost, and the arc ends: Transcendence is a real victory, and prestige makes replays faster.

**Intended feel:** the "how did it get this big?" vertigo of a good incremental, plus pride in a colony shaped by the player's own choices about who gathers, who digs, who fights and what to risk. [ASSUMPTION: from brief, not yet stated by owner]

**Tone:** terse. Story arrives in short beats and a running event log, never in long scripted scenes (A Dark Room, not a visual novel).

### Target Audience

- **Primary:** mobile idle players who check in for 30–90 s several times a day, one-handed in portrait. They expect offline progress and sessions they can drop at any moment. [ASSUMPTION: session shape, carried from brief]
- **Secondary:** desktop-browser incremental players (Universal Paperclips, Kittens Game) who play longer sessions. The layout scales up for them; it is not designed around them.

### Unique Selling Points (USPs)

1. **A real ending across six scales.** The game zooms out from a nursery to a singularity, and each scale brings new verbs. Most mobile idle games run forever on one number line.
2. **Growth stays physical.** Integer ants, egg → larva → worker pipelines, nest capacity and food upkeep. A bigger colony is a bigger logistics problem, not just a bigger multiplier.
3. **Premium-feeling, reveal-driven idle.** No ads, no gacha, no energy timers. The interface reveals itself a phase at a time, like A Dark Room. [ASSUMPTION: differentiators not yet confirmed by owner]

---

## Goals and Context

### Project Goals

1. Ship a phone-playable MVP covering Phases 1–3 (Egg Laying → Colony → Combat) in which every check-in offers at least one decision (see *Gameplay Metrics*).
2. Make every existing phase feel complete (enough decisions, events, upgrades and pacing polish) before any content is added after Transcendence.
3. Reach a full first victory that a mobile player can finish in a bounded, intentional time (see *Difficulty Curve*).
4. Keep the design fun-first. Monetization and retention metrics are out of scope.

### Background and Rationale

A desktop-shaped prototype of the full six-phase arc exists: about 23 panels, about 1,300 unit tests and 24 E2E specs. It proves that the arc and its systems hang together. It was tuned with "pacing nerfs" and no playtest data, and laid out for desktop. The owner treats it as evidence, not as a commitment. This GDD keeps the pillars the prototype demonstrates, re-targets pacing for phone check-ins, and decides open design questions (prestige carry-over, offline cap). Whether to keep the stack is left to `gds-game-architecture`.

**References (take / leave):**

| Title | Take | Leave |
|---|---|---|
| Universal Paperclips | Scale shifts that change the game, cosmic endgame, rate-based production | Text-only austerity |
| A Dark Room (mobile) | UI revealed a phase at a time, terse narrative, a mobile incremental with an ending | Heavy scripted story |
| Kittens Game | Population allocation as the core skill | Spreadsheet sprawl |
| Idle Ants / Pocket Ants | Proof the ant theme works on mobile | Ad- and gacha-driven loops, no ending |
| Cookie Clicker | Tap to bootstrap, prestige upgrades | Endless tapping as a core verb |

**Team and stakes:** solo owner working with AI coding agents (GitHub issue → PR → CI). Passion project: no launch date, revenue target or publisher.

---

## Core Gameplay

### Game Pillars

Every feature must serve at least one pillar. A feature that serves none is cut or parked.

**Structural requirement (not a pillar): respect the check-in.** Every feature must work in a 30–90 s phone session and must keep making progress offline. Offline and check-in features (Epic 2) answer to this requirement, not to a pillar.

1. **Every number is an ant.** All resources are integers. Population moves through physical pipelines (egg → larva → worker), is bounded by nest capacity and costs food upkeep. *Steers:* no fractional resources, no abstract "colony power" stat, and no multiplier that does not come back to countable units. A new resource must be producible before the feature that consumes it exists.
2. **Each phase changes the game.** Every phase adds at least one new kind of decision, one narrative beat and its own visual identity. *Steers:* a phase that only raises numbers is incomplete. A content addition that fits no phase's new decision type goes to the parking lot.
3. **Allocation beats clicking.** Tapping bootstraps Phase 1 only. The skill is in splitting the workforce, and automation takes over rote actions as soon as the player has shown they understand them. *Steers:* no late-game mechanic needs repeated tapping. Every automation replaces a verb the player has already performed by hand.
4. **Growth bites back.** Scale brings consequences: food upkeep, overcrowding, combat losses, risky decisions and double-edged entropy. *Steers:* every major growth lever has a visible cost or risk. There is no strictly dominant "buy everything" path.

### Core Gameplay Loop

| Loop | Duration | Player actions | Reward |
|---|---|---|---|
| **Check-in** | 30–90 s | Collect the offline summary → reassign workers → answer a pending decision → buy one upgrade or building | Visible growth since last visit, one meaningful choice |
| **Mid loop** | Hours (across check-ins) | Build and upgrade buildings, turn combat drops into equipment and mutations, claim map tiles, run research chains | New capability: a building level, a mutation, territory |
| **Outer loop** | Days (per phase) | Meet a phase guard → phase transition | New scale of play: new verbs, narrative beat, new look |
| **Meta loop** | Per run | Prestige → spend Legacy Points on permanent upgrades | Faster later runs, new starting options |

Each check-in must offer **at least one decision worth making** (an allocation change or an affordable upgrade; a decision event counts when one is active). If it doesn't, the pacing is broken. Decision events fire only while the game is open and do not queue offline (owner decision), so allocation and upgrades must carry this rule on their own. [ASSUMPTION: rule proposed in drafting; confirm]

### Win/Loss Conditions

- **Win:** reach Transcendence (void crystals (VC) ≥ 2000, antimatter ≥ 400, dark matter ≥ 200 at baseline) and complete its ending sequence. Victory is recorded permanently and survives prestige as a record only (see *Prestige and Reset Mechanics*).
- **No hard loss.** The colony cannot be wiped out. Setbacks are soft: battles lost cost soldiers, starvation stops growth and shrinks the workforce, failed expeditions cost scouts and warriors, and entropy erodes production. The design rule is that a setback costs time, never the run.
- **Soft-lock prohibition:** from every reachable state, the player can make progress without prestiging. A guard that cannot be met with the current resources is a bug.

---

## Game Mechanics

### Primary Mechanics

| Mechanic | Player capability | Baseline values | Pillar |
|---|---|---|---|
| **Lay egg** | Tap the queen to lay eggs | 1 egg per tap + 1 per Click Power level (cost 10 food, ×1.15 per level) | 3 (bootstrap only) |
| **Population pipeline** | Eggs hatch into larvae, larvae mature into workers | Hatch 50 ticks, mature 50 ticks, at 20 ticks/s [NOTE FOR DESIGNER: code comment says "1 s per tick"; at 20 Hz, 50 ticks = 2.5 s. Confirm the intended unit in the pacing pass] | 1 |
| **Worker roles** | Assign workers to Gather, Forage, Tend, Dig, Guard, Research | Gather: 2 food plus some wood. **Forage (new):** nectar. **Dig:** nest capacity plus stone. Tend: +25% hatch rate each. Unassigned: half gather rate. Upkeep: workers / 2 food. Wood, stone and nectar yields are new; rates are set in the pacing pass [ASSUMPTION] | 1, 3 |
| **Nest capacity** | Dig and Warehouse raise the population ceiling | Capacity = base + Warehouse effect | 1, 4 |
| **Scale penalty** | Efficiency drops above 500 workers | `1 / (1 + 0.0005 × (workers − 500))` | 4 |
| **Buildings** | Build and upgrade 6 buildings | Cost `floor(base × 2.5^level)`. Soft cap above Lv.5: `effect / (1 + 0.08 × (level − 5))` | 1, 4 |
| **Combat soldiers** | Train soldiers that auto-battle escalating enemies | 5 food + 1 worker, 75-tick training. Weapons/armor to Lv.5. Enemies scale with battles won^0.6; max 20 rounds per battle | 2, 4 |
| **Scouts and warriors** | Recruit an expedition force | Barracks Lv.1: up to 2 scouts. Lv.2: up to 3 scouts and 2 warriors. Partial-success losses split proportionally | 2, 4 |
| **Decision events** | Answer timed choice pop-ups | Every 2–3 min while the game is open; never queued offline. Baseline set: Beetle Sighting, Overcrowding!, Scout Report | 2, 4 |
| **Mutations** | Spend combat drops on permanent colony traits | 6: Efficient Gatherers, Swift Soldiers, Accelerated Hatching, Tough Shells, Potent Venom, Reinforced Mandibles | 2 |
| **Territory** | Discover and claim 8×8 map tiles | Forest 25%, Meadow 20%, Mountain 15%, Empty 30%, Enemy Nest 10%. Claimed tile: 0.5 per tick per worker of its type (unit to confirm, see note). Max 3 active expeditions | 2, 1 |
| **Research** | Run research chains with refundable cancellation | Two trees (automation, space). Cancel refunds 50% | 3 |
| **Spaceships and planets** | Build ships, explore 4 planets for space resources | Scout ship 15 VC (+ basic resources), cruiser 200 VC, capital ship 800 VC. Planets: Mars (antimatter), Saturn (dark matter), Europa (void crystals), Kepler-442b (food + VC). Max 3 active explorations | 2 |
| **Entropy** | Dark matter accelerates entropy, which erodes production | Entropy 0–100. +0.1 per dark matter (per tick; unit to confirm). Dampener: 10 VC + 50 stone. Entropy also feeds the prestige bonus | 4 |

[NOTE FOR DESIGNER: research cost `darkMatterDetection: { antimatter: 0.1 }` breaks Pillar 1 (integer resources). Change it to an integer cost in the pacing pass.]

### Controls and Input

**Mobile (primary), portrait, one-handed:**
- One primary action per screen, reachable by the thumb in the bottom 40% of a 360×640 viewport.
- Tap: lay egg, confirm, buy. Tap-and-hold on a buy or assign control repeats it (about 8/s). Steppers (−/+) with ×1, ×10 and ×max toggles for worker assignment.
- Bottom tab bar with at most 5 destinations. Each phase adds or changes tabs; it never adds a sixth. The 23 desktop panels are consolidated into those destinations (exact information architecture goes to `gds-ux`).
- Hit targets at least 44×44 pt. No hover-only information. Every tooltip has a tap equivalent.
- Decision events appear as a bottom sheet. They pause their own timer while the app is backgrounded.

**Desktop (secondary):** same screens, laid out in two or three columns. Mouse click equals tap. Keyboard shortcuts: Space lays an egg, 1–5 switch tabs. [ASSUMPTION: shortcut set]

---

## Idle/Incremental Game Specific Elements

### Core Click/Interaction

- Tapping lays eggs and matters only in Phase 1 (Pillar 3). Target: tapping supplies at least 80% of eggs in the first 2 min and under 10% once the player reaches Colony. [ASSUMPTION: targets]
- Satisfaction comes from the egg visibly entering the pipeline, not from the count going up. Each tap gives immediate visual and haptic feedback (haptics on mobile where available).
- Click Power is the only tap upgrade. After Phase 1 there is no tap-scaling upgrade path. The Legacy upgrade Auto Egg Laying removes tapping from later runs entirely.

### Upgrade Trees

| Tree | Unlocks in | Currency | Contents (baseline) |
|---|---|---|---|
| Click | Phase 1 | Food | Click Power |
| Buildings | Phase 2 (combat buildings in Phase 3) | Food, wood, stone, nectar, combat drops | Barracks, Walls, Warehouse, Silk Weaving, Chitin Armory, Venom Lab |
| Equipment | Phase 3 | Food, combat drops | Weapons and armor, Lv.1–5 |
| Mutations | Phase 3 | Silk, chitin, venom | 6 mutations |
| Automation research | Phase 2+ | Food, wood, workers, stone, VC | Basic Incubation, Queen's Pheromones, Thermal Regulation, Genetic Optimization |
| Space research | Phase 4–5 | Stone, nectar, VC, antimatter | Void Crystal Synthesis, Antimatter Containment, Dark Matter Detection |
| Legacy (prestige) | After first prestige | Legacy Points | 8 nodes (see *Meta-Progression*) |

**Design rules:**
- Each tree unlocks with the phase whose new decision it serves (Pillar 2).
- No upgrade is strictly dominant. Every tier offers at least two purchases that compete for the same currency. [ASSUMPTION: rule]
- Phases 1–3 currently have shallow trees, which is the "thin mid-game" risk. Epic 4 adds content until each MVP phase meets the depth bar in *Level Progression*.

### Automation Systems

- Automation replaces a verb the player has already performed by hand (Pillar 3). Order: egg laying (Legacy Auto Egg Laying) → hatching (Basic Incubation, Thermal Regulation) → recruitment and soldier training → expeditions and explorations.
- **Unlock rule:** a verb can be automated once the player has performed it manually at least N times or reached the phase after the one that introduced it. [ASSUMPTION: N = 10; tune in pacing pass]
- Automation is never all-or-nothing. Each automated verb has a player-set target (for example "keep 20 soldiers in training"), so allocation stays the skill.
- Offline progress simulates the same automation the player configured. It never makes decisions on their behalf. Decision events fire only while the game is open; none are generated or queued offline.

### Prestige and Reset Mechanics

- **Unlock:** Barracks, Walls and Warehouse at Lv.5; lifetime production of 100,000 food, 50,000 wood, 50,000 stone and 25,000 nectar (baseline).
- **Currency:** Legacy Points (LP) = `floor(log10(totalFoodProduced) × phaseScore / 10)` + entropy bonus (baseline: floor(entropy × 2), only at entropy 100, otherwise 0). phaseScore is the sum of phase indices reached (Space = 1+2+3+4+5 = 15).
- **Bonus (decided):** +15% production per LP *earned* across all runs. Spending LP on the Legacy tree never lowers the bonus. (The baseline counts LP currently held; this changes.)
- **Decision (resolves #192): a prestige wipes everything except:**
  - LP and purchased Legacy upgrades
  - lifetime statistics (total food, eggs laid, clicks, battles)
  - the victory record, kept as a permanent record and achievement. It does not skip, unlock or shortcut anything.
- **Wiped:** all resources, including void crystals, antimatter, dark matter and survey data; buildings; research; mutations; equipment; territory; ships; phase (reset to Egg Laying, or to Colony with the Phase Skip upgrade). This is a change from the baseline, which keeps space resources. A migration must handle existing saves (Epic 5).
- **Why:** each run is clean and revisits every scale (Pillar 2). Faster replays come from LP, which is legible, rather than from leftover resources, which skip Phase 5's decisions.
- **Target:** a second run reaches the first run's furthest phase in at most 50% of the time. [ASSUMPTION: target]

### Number Balancing

- **Integers only.** Every resource and cost uses `floor()`. Entropy is a 0–100 meter, not a resource; fractional values are internal and displayed rounded. Non-integer intermediate values (pipeline progress, rates) are allowed internally but are never shown or spent.
- **Growth shapes (baseline):** building costs are exponential (×2.5 per level), building effects are soft-capped above Lv.5, worker efficiency decays linearly above 500, enemy strength grows sub-linearly (battles won^0.6), and LP grows logarithmically with lifetime food.
- **Display:** numbers up to 999,999 are shown in full. Above that, short-scale suffixes (1.2M, 3.4B). No scientific notation before Transcendence. [ASSUMPTION: display rule; prototype has break_infinity support]
- **Walls and wall-breakers:** phase guards are the time gates; Legacy upgrades are the wall-breakers.
- **Pacing guards:** every phase guard must be reachable from that phase's own production, with no prestige, within the target duration (see *Difficulty Curve*).

### Meta-Progression

- **Legacy tree (baseline, 8 nodes):** egg-laying bonus (3 LP), hatching bonus (3), food bonus (3), soldier-training bonus (5), worker-efficiency bonus (5), starting resources (8), Auto Egg Laying (10), Phase Skip (12).
- **Offline efficiency chain (decided):**
  - **Step 1, 50% → 75%: run research**, available in Phases 2–3 and paid in that phase's currencies, so the first run benefits. It is wiped on prestige like other research and re-bought cheaply each run. [ASSUMPTION: research cost tuned in pacing pass]
  - **Step 2, 75% → 100%: Legacy upgrade** (replaces the baseline Temporal Resonance / Chrono Synchronization pair). It survives prestige.
  - **Cap raises (12 h → 24 h):** Legacy upgrades, which survive prestige.
  - Baseline note: today Temporal Resonance (10 LP) requires Transcendence, so a first run stays at 50% throughout. Epic 2 replaces this.
- **Phase Skip review:** Phase Skip must not skip a phase the player has never completed. [ASSUMPTION: rule, in line with Pillar 2]
- **Achievements:** victory record only in v1.0. Challenge runs and further prestige layers are parked.
- **Post-Transcendence:** parked. No new meta layer until Phases 1–5 meet the depth bar.

---

## Progression and Balance

### Player Progression

Progression is gated by phase. Guards at baseline:

| Transition | Guard |
|---|---|
| Egg Laying → Colony | workers ≥ 10 |
| Colony → Combat | workers ≥ 50 and ≥ 1 guard assigned |
| Combat → Expansion | workers ≥ 60 and battlesWon ≥ 5 |
| ~~Colony → Expansion (alternate)~~ | ~~workers ≥ 40 and food ≥ 1000~~ (baseline only; **removed**, see below) |
| Expansion → Space | workers ≥ 80 and food ≥ 5000 |
| Space → Transcendence | void crystals ≥ 2000, antimatter ≥ 400, dark matter ≥ 200 |

**Decision: Combat is mandatory.** The baseline's Colony → Expansion alternate route is a leftover and is removed (Epic 3). Every run passes through Combat. A deliberate peaceful path is a parked idea (see *Out of Scope*). If it is ever added, Combat-only rewards (silk, chitin, venom and the mutations they buy) need a non-combat source, and Combat must stay worth choosing.

### Difficulty Curve

Phase duration targets in real time, for a player who checks in about 6 times a day. **First victory in about 3 weeks is decided (owner).** The per-phase split below derives from it and is to be validated in playtest. [ASSUMPTION: per-phase split]

| Phase | Active-play target | Real-time target (with check-ins) |
|---|---|---|
| 1 Egg Laying | 3–5 min | First session |
| 2 Colony | 20–40 min | Day 1 |
| 3 Combat | [ASSUMPTION: TBD from E3 telemetry] | Days 2–3 |
| 4 Expansion | [ASSUMPTION: TBD from E3 telemetry] | Days 4–7 |
| 5 Space | [ASSUMPTION: TBD from E3 telemetry] | Weeks 2–3 |
| 6 Transcendence | Ending sequence ≤ 5 min [ASSUMPTION] | Reached at about 3 weeks (the victory) |

The curve is a staircase: each phase opens with a burst of new options, then slows until the guard is in sight. A check-in where the next affordable thing is more than one check-in interval away (about 4 h) is a pacing defect.

### Economy and Resources

| Tier | Resources | Sources | Sinks |
|---|---|---|---|
| Population | eggs, larvae, workers | Tapping, queen, pipeline | Soldiers (1 worker each), research costs, upkeep |
| Basic | food, wood, stone, nectar | Worker roles from Phase 2 (Gather: food + wood; Forage: nectar; Dig: stone); claimed tiles and expeditions from Phase 4 | Upkeep, buildings, soldiers, research |
| Combat drops | silk, chitin, venom | Battles | Combat buildings, mutations |
| Space | void crystals, antimatter, dark matter, survey data | Expeditions (10% chance of space drops), planets, research | Ships, Transcendence guard, entropy dampener |

**Offline progress (decision):**
- **Cap 12 h** (baseline 4 h). Legacy upgrades can raise it to 24 h. [ASSUMPTION: 24 h ceiling]
- **Efficiency:** base 50%; Phase 2–3 research raises it to 75%; a Legacy upgrade raises it to 100% (see *Meta-Progression*).
- On return, the player sees a summary sheet: elapsed time, resources gained, and the one most useful next action (decision events do not queue offline). Starvation offline cannot drop workers below 50% of their pre-absence count. [ASSUMPTION: floor]
- Optional local notifications: "nest is full" and "offline cap reached". Off by default. [ASSUMPTION: opt-in]

[NOTE FOR DESIGNER: the baseline has two offline caps, 4 h in `OfflineProgression.ts` and 8 h in the game-loop catch-up. The new model needs a single cap; architecture decides where it lives.]

**Phase 2 basic-resource rule (decided):** wood, stone and nectar must be producible from worker roles in Phase 2, so the Buildings tree is buyable in the MVP. Territory adds to these from Phase 4; it is no longer their only source.

**Catch-22 rule:** every resource must be producible before the feature that consumes it unlocks (scout ships bootstrap through the 10% expedition space-resource drops).

---

## Level Design Framework

### Level Types

The game's "levels" are its six phases. Each defines a scale, a new decision type and a visual identity:

| Phase | Scale | New decision type | Narrative beat |
|---|---|---|---|
| 1 Egg Laying | Brood chamber | Tap vs. wait; first allocation | The queen alone |
| 2 Colony | Nest | Worker-role split, buildings | A colony forms |
| 3 Combat | Battlefield | Soldiers vs. workers, equipment, mutations | First enemy |
| 4 Expansion | 8×8 surface map | Which tiles to scout, claim, risk | The world above |
| 5 Space | Star map, 4 planets | Ship investment, entropy trade-off | Leaving the planet |
| 6 Transcendence | Singularity | Final conversion; the ending | Leaving physical existence |

### Level Progression

- Phases are strictly sequential. There are no alternate routes (the baseline Colony → Expansion shortcut is removed).
- **Depth bar for a "complete" phase** (applies to MVP Phases 1–3 first): at least 3 decision events unique to the phase, at least 4 purchasable upgrades or buildings competing for its currencies, at least 1 narrative beat on entry and 1 near its guard, and a progress readout showing how close the guard is. [ASSUMPTION: bar values]
- **Combat interest bar (Phase 3).** Battles resolve automatically, so the interest comes from the decisions around them, never from watching them:
  - **Before battle:** how many workers to turn into soldiers (each costs 1 worker + food, Pillar 4), when to commit, and which equipment and mutations to buy.
  - **Visible counterplay:** each enemy shows a trait or type before the fight. At least 3 enemy types reward different soldier, equipment or mutation choices, so there is no single build that always wins. [ASSUMPTION: 3 types]
  - **Stakes:** a loss costs soldiers and time (never the run). Wins drop silk, chitin and venom, the only source of those resources.
  - **Readable result:** each battle ends in a short summary of why it was won or lost (for example, "their armor beat your venom") so the player knows what to change.
  - **No dominant strategy:** "train the maximum and wait" must not be the best play at every step. Food upkeep and the worker cost keep army size a real trade-off.
- Each phase changes the screen layout and palette on entry (Pillar 2). The reveal is the reward.

---

## Art and Audio Direction

### Art Style

- **Baseline:** dark earth-toned UI, a per-phase color theme, emoji icons as placeholders.
- **Direction:** readable at arm's length on a phone. Each phase owns a palette shift. Ants are shown as countable units where the screen allows (for example, a nest cross-section that fills up), so Pillar 1 is visible. Detailed art direction goes to `gds-ux`.
- Constraint: solo owner, no art budget. Art must be producible with procedural/vector assets or a small icon set. [ASSUMPTION: carried from brief]

### Audio and Music

- **Baseline:** 5 synthesized sound effects, no music.
- **MVP:** sound effects for tap, hatch, battle result, phase transition and decision event. Sound effects are muted by default on mobile and respect the device's silent mode.
- **Music:** out of scope for MVP. A per-phase ambient layer is a later candidate. [ASSUMPTION]

---

## Technical Specifications

### Performance Requirements

- First interactive screen in under 3 s on a mid-range phone (about 2022 Android) over 4G. [ASSUMPTION: device class]
- Interface responds to a tap within 100 ms. Scrolling and transitions hold 60 FPS. Game outcomes are independent of frame rate and device speed (tick rate is an architecture decision).
- Offline catch-up for a 12 h absence completes in under 500 ms on resume.
- No processing while the app is backgrounded (progress is computed on return), so the game costs no battery while closed.

### Platform-Specific Details

- Portrait, 360×640 minimum, safe-area aware. Desktop layout from 1024 px width.
- Saves are local and versioned with migrations. Existing prototype saves must migrate or be retired explicitly (architecture decides). Rotating backup is kept.
- Distribution (mobile web/PWA, native wrapper or app stores) and stack (keep, adapt or replace) go to `gds-game-architecture`.

### Asset Requirements

- Icon set covering about 20 resources and 6 buildings, a palette for each of the 6 phases, 5+ sound effects.
- Total initial download under 2 MB. [ASSUMPTION]

---

## Development Epics

### Epic Structure

| # | Epic | Scope | MVP |
|---|---|---|---|
| E1 | Mobile shell and screens | Portrait layout, at most 5-tab navigation, consolidate panels | ✅ |
| E2 | Offline and check-in | 12 h cap, single offline model, return summary, opt-in notifications | ✅ |
| E3 | Pacing pass, Phases 1–3 | Play telemetry (local), tune against duration targets, fix integer and tick-unit issues | ✅ |
| E4 | Phase depth, Phases 1–3 | Meet the depth bar: events, upgrades, narrative beats, guard readouts | ✅ |
| E5 | Prestige rework | Full wipe except LP, Legacy upgrades, lifetime stats and victory record; save migration (#192) | ✅ |
| E6 | Phases 4–5 on mobile, with depth | Map and star map in portrait, depth bar, entropy tuning | — |
| E7 | Transcendence and ending | Ending sequence, victory record, Legacy balance | — |
| E8 | Art and audio pass | Direction from `gds-ux`, icon set, phase palettes, sound effects | Partial |

**Sequence:** E1 → E2 → E3 ↔ E4 (iterate) → E5 → MVP playtest → E6 → E7, with E8 running in parallel from E1. Details are in `epics.md`.

---

## Success Metrics

### Technical Metrics

- All performance targets in *Technical Specifications* met on the reference device.
- Zero soft-locks: an automated check that every phase guard is reachable from that phase's own production.
- Save migration from every shipped save version passes.

### Gameplay Metrics

Passion project: these are quality signals from playtests, not business KPIs.
- Phase 1 finished in under 5 min by at least 4 of 5 first-time playtesters.
- Median check-in length 30–90 s. Every check-in offers at least one decision.
- Playtesters return voluntarily on day 2 and day 3 of the MVP.
- Measured time to first victory, compared against the target of about 3 weeks.

---

## Out of Scope

- **Cut for v1.0:** monetization, ads, gacha and energy systems; accounts and cloud saves; multiplayer and leaderboards; music.
- **Parked (post-launch):** a peaceful path that skips or replaces Combat (needs a non-combat source of silk, chitin and venom); content after Transcendence; challenge runs and additional prestige layers; new phases; additional planets or ship classes before Phases 1–5 meet the depth bar.
- **Decided elsewhere:** stack, distribution channel and engine (architecture); detailed information architecture and visual design (UX).

---

## Assumptions and Dependencies

**Dependencies:** `gds-ux` for information architecture and art direction; `gds-game-architecture` for stack, distribution and the offline/save model; playtesters for pacing validation.

**Assumption index:**
1. Intended feel ("how did it get this big?" vertigo plus pride in own choices), carried from the brief.
2. Session shape: 30–90 s check-ins, about 6 per day.
3. Differentiators (real ending, physical growth, premium-feeling reveal) not yet confirmed by the owner.
4. "At least one decision per check-in" rule.
5. Per-phase duration split (the 3-week total is decided).
6. Tap-share targets for Phase 1.
7. "No dominant upgrade" rule.
8. Automation unlock after 10 manual performances.
9. Offline: 24 h ceiling, 50% starvation floor, opt-in notifications.
10. Number display rule (full to 999,999, then suffixes).
11. Phase Skip cannot skip a never-completed phase.
12. Second run reaches the furthest phase in at most 50% of the time.
13. Depth bar values (3 events, 4 upgrades, 2 beats per phase); 3 enemy types in Combat.
14. No art budget; music out of scope for MVP (ambient layer later); 2 MB download; reference device class; desktop shortcuts.
15. Offline-efficiency research cost.
16. Phase 3–5 active-play minutes and ending-sequence length.
17. Wood, stone and nectar yields from Gather, Forage and Dig.

**Notes for the designer (open):**
- Tick-unit mismatch in hatch, mature and train times, and in the per-tick territory and entropy rates.
- Non-integer research cost (`antimatter: 0.1`).
- Two offline caps in the baseline (4 h and 8 h).
- Name collision with Swarm Simulator: is renaming in scope?
