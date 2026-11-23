---
title: "THE SWARM - Game Design Document"
game_type: idle-incremental
platforms: ["mobile (portrait, touch) - primary; distribution TBD in architecture", "desktop browser - secondary"]
status: final
created: 2026-11-20
updated: 2026-11-23
inputs:
  - _bmad-output/planning-artifacts/briefs/brief-the-swarm-2026-11-20/brief.md
  - _bmad-output/playtest-2026-11-22.md
  - _bmad-output/brainstorming-session-2026-11-22.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-11-23.md
baseline_code: "Seven74AI/the-swarm main @ 0b0b364"
---

# THE SWARM - Game Design Document

**Author:** Seven74
**Game Type:** Idle/Incremental
**Target Platform(s):** Mobile first (portrait, touch); desktop browser second

> **Reading this document.** Numbers marked *baseline* are the values in the current build (main @ 0b0b364), recorded so architecture and epics start from reality. They are not commitments: the pacing pass (Epic 3) re-tunes them against the targets in *Progression and Balance*. Targets are design intent. The first-week pacing correction (2026-11-23, issue #438, `sprint-change-proposal-2026-11-23.md`) changed the session shape, the scale, capacity, crowding, starvation and the phase targets; sections it touched say so. Source code stays authoritative for current behavior; phase guards live only in `src/phases/transitions.ts`.

---

## Executive Summary

### Core Concept

You are the queen whose single egg becomes a swarm big enough to swallow the universe. THE SWARM is a mobile-first incremental game. Each of its six phases (nest, colony, battlefield, territory, space, transcendence) changes *what* the player manages, not only how big the numbers get. Every resource is a countable integer, growth always has a physical cost, and the arc ends: Transcendence is a real victory, and prestige makes replays faster.

**Intended feel:** the "how did it get this big?" vertigo of a good incremental, plus pride in a colony shaped by the player's own choices about who gathers, who digs, who fights and what to risk. [ASSUMPTION: from brief, not yet stated by owner]

**Tone:** terse. Story arrives in short beats and a running event log, never in long scripted scenes (A Dark Room, not a visual novel).

### Target Audience

- **Primary:** mobile idle players, one-handed in portrait. They expect offline progress and sessions they can drop at any moment. The first week is hands-on and tapers into check-ins of 90–120 s, about 6 a day (see *Session Shape*; owner, 2026-11-22).
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

**Structural requirement (not a pillar): respect the check-in.** Every feature must work in a 90–120 s phone check-in (the steady state after the first week) and must keep making progress offline. Offline and check-in features (Epic 2) answer to this requirement, not to a pillar.

1. **Every number is an ant.** All resources are integers. Population moves through physical pipelines (egg → larva → worker), is bounded by nest capacity and costs food upkeep. *Steers:* no fractional resources, no abstract "colony power" stat, and no multiplier that does not come back to countable units. A new resource must be producible before the feature that consumes it exists.
2. **Each phase changes the game.** Every phase adds at least one new kind of decision, one narrative beat and its own visual identity. *Steers:* a phase that only raises numbers is incomplete. A content addition that fits no phase's new decision type goes to the parking lot.
3. **Allocation beats clicking.** Tapping is a boost for the hands-on first week, never a requirement: LAY EGG bootstraps Phase 1, DIG and FEED speed up Phases 2–3, and a player who never taps still progresses, only slower. The skill is in splitting the workforce, and bought automation takes over rote actions once the player has shown they understand them. *Steers:* no mechanic requires repeated tapping, and none after the first week rewards it much. Every automation replaces a verb the player has already performed by hand. (Changed 2026-11-23: was "tapping bootstraps Phase 1 only".)
4. **Growth bites back.** Scale brings consequences: food upkeep and starvation, crowding, combat losses, risky decisions and double-edged entropy. *Steers:* every major growth lever has a visible cost or risk. There is no strictly dominant "buy everything" path.

### Session Shape

*Decided by the owner after the 2026-11-22 playtest (party mode, issue #438). Replaces the earlier assumption of 30–90 s check-ins from the first day.*

| When | Session | What carries it |
|---|---|---|
| **Session 1** | 45–60 min of continuous play. **No wait wall before about 30 min**: the player is never left with nothing useful to do for more than 2 min. | Phase 1 (LAY EGG), then Colony as the hook: DIG rooms, FEED larvae into them, first buildings |
| **Days 1–3** | Sessions of 5–15 min, about 6 a day | Colony's goal (later on day 1), then Combat's first decisions; digging by hand until auto-dig is bought |
| **Days 4–7** | Sessions shrinking toward the steady state | Combat, with new decisions each day (not slower timers) |
| **After about a week** | Check-ins of **90–120 s**, about 6 a day, each with at least one decision | Allocation, buildings, research, combat choices; automation carries the rote verbs |

Phases 1–3 are stretched across this first week with new decisions, not slower timers (owner chose this over pulling Phases 4–5 in). The `pnpm sim` gates in *Success Metrics* measure it.

### Core Gameplay Loop

| Loop | Duration | Player actions | Reward |
|---|---|---|---|
| **First-week session** | 45–60 min (session 1), then 5–15 min | DIG a room (stone falls out) → FEED larvae into it → buy a building → dig again | A nest that visibly grows, room by room |
| **Check-in** | 90–120 s (after about a week) | Collect the offline summary → reassign workers → answer a pending decision → buy one upgrade or building | Visible growth since last visit, one meaningful choice |
| **Mid loop** | Hours (across check-ins) | Build and upgrade buildings, turn combat drops into equipment and mutations, claim map tiles, run research chains | New capability: a building level, a mutation, territory |
| **Outer loop** | Days (per phase) | Meet a phase guard → phase transition | New scale of play: new verbs, narrative beat, new look |
| **Meta loop** | Per run | Prestige → spend Legacy Points on permanent upgrades | Faster later runs, new starting options |

Each check-in must offer **at least one decision worth making** (an allocation change or an affordable upgrade; a decision event counts when one is active). If it doesn't, the pacing is broken. Decision events fire only while the game is open and do not queue offline (owner decision), so allocation and upgrades must carry this rule on their own. The game offers the decision; the return summary does not point at it (owner, 2026-11-22: the summary reports only what happened while away, PR #439).

### Win/Loss Conditions

- **Win:** reach Transcendence (void crystals (VC) ≥ 2000, antimatter ≥ 400, dark matter ≥ 200 at baseline) and complete its ending sequence. Victory is recorded permanently and survives prestige as a record only (see *Prestige and Reset Mechanics*).
- **No hard loss.** The colony cannot be wiped out: the queen, eggs and larvae never starve. Setbacks are soft: battles lost cost soldiers, starvation kills just enough workers and soldiers to bring food use back to production (see *Space and Food*), failed expeditions cost scouts and warriors, and entropy erodes production. The design rule is that a setback costs time, never the run.
- **Soft-lock prohibition:** from every reachable state, the player can make progress without prestiging. A guard that cannot be met with the current resources is a bug.

---

## Game Mechanics

### Primary Mechanics

| Mechanic | Player capability | Baseline values | Pillar |
|---|---|---|---|
| **Lay egg** | Tap the queen to lay eggs | 1 egg per tap + 1 per Click Power level (cost 10 food, ×1.15 per level) | 3 (bootstrap only) |
| **Population pipeline** | Eggs hatch into larvae, larvae mature into workers | Hatch 50 ticks, mature 50 ticks, at 20 ticks/s [NOTE FOR DESIGNER: code comment says "1 s per tick"; at 20 Hz, 50 ticks = 2.5 s. Confirm the intended unit in the pacing pass] | 1 |
| **Dig** (Phase 2 on) | Press **DIG**, the main button, to dig the next room; diggers add to every press and dig slowly on their own; bought auto-dig hands it to them | One press = one fixed chunk; each room takes more presses than the last; every chunk comes out as stone; a finished room holds several ants. Baseline: no DIG button, one digger ≈ 27 h per +1 capacity (`digMsPerRoom`). New values set in the batch 1 tuning story | 1, 3 |
| **Feed** (Phase 2 on) | Tap the brood in the nest scene to speed larvae toward becoming workers | Works only while a room is free; greyed out when the nest is full. Rate set in tuning | 3 |
| **Worker roles** | Assign workers to Gather, Forage, Tend, Dig, Guard, Research | Gather: 2 food plus some wood. **Forage (new):** nectar. **Dig:** adds to every DIG press and digs slowly on its own; stone comes from the dirt dug. Tend: +25% hatch rate each. Unassigned: half gather rate. Upkeep: workers / 2 food. Wood, stone and nectar yields are new; rates are set in the pacing pass [ASSUMPTION] | 1, 3 |
| **Nest capacity** | Rooms (dug), Warehouse and Gallery rooms raise the worker ceiling; a hard cap: larvae wait in the brood when it is full | Capacity = rooms × ants per room + Warehouse effect. Baseline: start 25, each room +1 | 1, 4 |
| **Crowding** (batch 2; replaces the scale penalty) | A packed nest works slower; digging relieves it | Work slows with creatures per unit of room space; everyone counts (workers, soldiers, eggs, larvae; not the queen). Shown in the scene and the NEXT ROOM strip (`CROWDED · −20% WORK`). Baseline it replaces: `workerEfficiency = 1 / (1 + 0.0005 × (workers − 500))`, invisible, gathering only | 1, 4 |
| **Starvation** (batch 2) | When food runs out, the colony shrinks to fit | Warning first; then only eaters die (workers and soldiers, at random), just enough to bring food use back to production, spread over time. Baseline: food clamps at 0 and nobody dies | 4 |
| **Food storage** (batch 2) | The nest stores only so much food | Food past the limit is lost; Larder rooms raise it. Baseline: no limit | 1, 4 |
| **Room jobs** (batch 2) | When a room opens, pick one of three jobs, or leave it plain | **Pantry:** starvation warns sooner and bites slower. **Larder:** raises the food limit. **Gallery:** holds twice as many ants. Colony-wide effects counted by rooms (no ant has a location) | 1, 4 |
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
- Tap: lay egg, dig, feed (a tap on the brood in the scene), confirm, buy. Tap-and-hold on a buy or assign control repeats it (about 8/s). Steppers (−/+) with ×1, ×10 and ×max toggles for worker assignment.
- Bottom tab bar with at most 5 destinations. Each phase adds or changes tabs; it never adds a sixth. The 23 desktop panels are consolidated into those destinations (exact information architecture goes to `gds-ux`).
- Hit targets at least 44×44 pt. No hover-only information. Every tooltip has a tap equivalent.
- Decision events appear as a bottom sheet. They pause their own timer while the app is backgrounded.

**Desktop (secondary):** same screens, laid out in two or three columns. Mouse click equals tap. Keyboard shortcuts: Space presses the primary action (LAY EGG, DIG), 1–5 switch tabs. [ASSUMPTION: shortcut set]

---

## Idle/Incremental Game Specific Elements

### Core Click/Interaction

- **Phase 1: LAY EGG.** Tapping lays eggs. Target: tapping supplies at least 80% of eggs in the first 2 min and under 10% once the player reaches Colony. [ASSUMPTION: targets]
- **Phase 2 on: DIG.** DIG takes LAY EGG's place as the single main button. One press digs one fixed chunk of the next room; the dirt comes out as stone. Each room takes more presses than the last, so the first session flies and digging slows as diggers take over. Diggers add to every press, and dig slowly on their own, so a player who never taps still gets rooms (Pillar 3). Later the player **buys auto-dig** (like the egg-laying automation); from then on the diggers press on their own and DIG becomes an optional boost.
- **FEED** is a tap on the brood in the nest scene, not a second button. It speeds larvae toward becoming workers, only while a room is free, so DIG and FEED take turns: dig a room, feed ants into it, dig again.
- **Progress is visible twice:** a crack grows at the dig face in the scene, and a NEXT ROOM strip in the nest panel shows a bar, the time left and the presses left.
- Satisfaction comes from the egg visibly entering the pipeline and the dirt visibly giving way, not from the count going up. Each press gives immediate feedback: LAY EGG as before; DIG a crunch, a small shake and a puff of dirt, and a vibration on breakthrough where the device supports it (iPhone Safari ignores the vibration API: there the breakthrough sound and shake carry it; owner, 2026-11-23).
- Click Power is the only egg-tap upgrade. The Legacy upgrade Auto Egg Laying removes egg tapping from later runs entirely. A cheap stone upgrade that makes each DIG press bigger (sharper mandibles) is planned for batch 3, held in check by rooms growing.

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

- Automation replaces a verb the player has already performed by hand (Pillar 3). Order: egg laying (Legacy Auto Egg Laying) → digging (bought auto-dig, Phase 2) → hatching (Basic Incubation, Thermal Regulation) → recruitment and soldier training → expeditions and explorations.
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
- **Scale (decided 2026-11-22):** THE SWARM reaches thousands of ants, not hundreds. The phase goals are rescaled to the ladder in *Player Progression*; numbers past 999,999 use the display rule below.
- **Growth shapes (baseline):** building costs are exponential (×2.5 per level), building effects are soft-capped above Lv.5, worker efficiency decays linearly above 500 (replaced by crowding in batch 2), enemy strength grows sub-linearly (battles won^0.6), and LP grows logarithmically with lifetime food.
- **Display:** numbers up to 999,999 are shown in full. Above that, short-scale suffixes (1.2M, 3.4B). No scientific notation before Transcendence. [ASSUMPTION: display rule; prototype has break_infinity support]
- **Walls and wall-breakers:** phase guards are the time gates; Legacy upgrades are the wall-breakers.
- **Pacing guards:** every phase guard must be reachable from that phase's own production, with no prestige, within the target duration (see *Difficulty Curve*).

### Meta-Progression

- **Legacy tree (baseline, 8 nodes):** egg-laying bonus (3 LP), hatching bonus (3), food bonus (3), soldier-training bonus (5), worker-efficiency bonus (5; with crowding it scales the work multiplier), starting resources (8), Auto Egg Laying (10), Phase Skip (12).
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

**Rescaled goals (decided 2026-11-22: the swarm reaches thousands).** The worker guards above are baseline and too small. Target ranges for the worker count each guard asks for; the exact values are set in `transitions.ts` by the tuning stories against the `pnpm sim` gates (owner, 2026-11-23: ranges here, sim picks exact):

| Guard | Baseline | Target range [ASSUMPTION: ranges] |
|---|---|---|
| Egg Laying → Colony | 10 workers | about 10–20 |
| Colony → Combat | 50 workers + 1 guard | about 150–300 (+ 1 guard) |
| Combat → Expansion | 60 workers + 5 wins | about 1,000–2,000 (+ wins) |
| Expansion → Space | 80 workers + 5,000 food | about 5,000 or more |

Phase 1–2 guards are rescaled with the DIG core (batch 1). Phase 3 and later need crowding first (batch 2), because the baseline scale penalty starts at 500 workers.

**Decision: Combat is mandatory.** The baseline's Colony → Expansion alternate route is a leftover and is removed (Epic 3). Every run passes through Combat. A deliberate peaceful path is a parked idea (see *Out of Scope*). If it is ever added, Combat-only rewards (silk, chitin, venom and the mutations they buy) need a non-combat source, and Combat must stay worth choosing.

### Difficulty Curve

Phase duration targets in real time, for the *Session Shape* above. **First victory in about 4 weeks (owner, 2026-11-23; was about 3 weeks).** Phases 1–3 fill the first week; Phases 4–5 move back by a week. The per-phase split is to be validated in playtest. [ASSUMPTION: per-phase split of Phases 4–5]

| Phase | Active-play target | Real-time target |
|---|---|---|
| 1 Egg Laying | 3–5 min | The first minutes of session 1 |
| 2 Colony | about 45–70 min (the rest of session 1 plus a short later session) [ASSUMPTION: derived] | Ends later on day 1, in a session after the first (owner, 2026-11-23) |
| 3 Combat | Days 2–7 of sessions, 5–15 min shrinking toward 90–120 s | Days 2–7: lasts to about day 7 |
| 4 Expansion | [ASSUMPTION: TBD after the MVP playtest] | Week 2 |
| 5 Space | [ASSUMPTION: TBD after the MVP playtest] | Weeks 3–4 |
| 6 Transcendence | Ending sequence ≤ 5 min [ASSUMPTION] | Reached at about 4 weeks (the victory) |

The curve is a staircase: each phase opens with a burst of new options, then slows until the guard is in sight. In session 1, more than 2 min with nothing useful to do before 30 min of play is a pacing defect. After the first week, a check-in where the next affordable thing is more than one check-in interval away (about 4 h) is a pacing defect.

### Economy and Resources

| Tier | Resources | Sources | Sinks |
|---|---|---|---|
| Population | eggs, larvae, workers | Tapping, queen, pipeline | Soldiers (1 worker each), research costs, upkeep |
| Basic | food, wood, stone, nectar | Worker roles from Phase 2 (Gather: food + wood; Forage: nectar; Dig: stone); claimed tiles and expeditions from Phase 4 | Upkeep, buildings, soldiers, research |
| Combat drops | silk, chitin, venom | Battles | Combat buildings, mutations |
| Space | void crystals, antimatter, dark matter, survey data | Expeditions (10% chance of space drops), planets, research | Ships, Transcendence guard, entropy dampener |

### Space and Food

*Batch 2 of the first-week pacing work (issue #438). Space and food are one system: how many ants the nest and the stores can hold.*

- **Capacity stays a hard cap on workers.** Rooms (dug), the Warehouse and Gallery rooms set it; larvae wait in the brood when it is full, and FEED only works while a room is free (owner, 2026-11-23).
- **Crowding replaces `workerEfficiency`.** Work slows with the number of creatures per unit of room space. Everyone takes up room: workers, soldiers, eggs and larvae (the queen aside), so a full brood crowds the nest too. Digging relieves it. Shown in the scene (an over-full room spills into the tunnels) and in the NEXT ROOM strip (`CROWDED · −20% WORK`). Upkeep is not reduced, so crowding bites.
- **Starvation.** A warning comes first (`FOOD RUNS OUT IN 2M`). Then only eaters die (workers and soldiers, at random); eggs, larvae and the queen never starve. The colony **shrinks to fit**: just enough eaters die to bring food use back to production, spread over time (one death every few seconds), so the player can react. While away, at most **20%** of the eaters can be lost (the offline floor rises from 50% to 80% kept). The warning and the offline cap ship together with deaths, or not at all.
- **Food storage limit.** The nest stores only so much food; food past the limit is lost. Larder rooms raise it. The offline summary says when food stopped at the limit; the resource strip shows the capped state.
- **Room jobs.** When a room opens, the player picks one of three jobs with one tap, or leaves it plain (a plain room is always fine): **Pantry** (starvation warns sooner and bites slower), **Larder** (raises the food limit), **Gallery** (holds twice as many ants). Effects are colony-wide, counted by rooms; no ant has a location.
- **Offline-safe rule:** crowding and starvation are formulas of the current state, so the offline catch-up steps give the same result as live play.
- **Later (batch 3 or a later phase):** a building that lets the player choose who goes hungry first (workers or soldiers).

**Offline progress (decision):**
- **Cap 12 h** (baseline 4 h). Legacy upgrades can raise it to 24 h. [ASSUMPTION: 24 h ceiling]
- **Efficiency:** base 50%; Phase 2–3 research raises it to 75%; a Legacy upgrade raises it to 100% (see *Meta-Progression*).
- **Short gaps (decided):** time away under 60 s (a glance at another app, a stalled frame) counts at full efficiency and shows no summary. From 60 s on, the time is offline: the offline efficiency and cap apply and the summary sheet opens. The same rule applies whether the player returns from the background or cold-loads.
- On return, the player sees a summary sheet: elapsed time, efficiency, resources gained and lost, and whether the cap was reached. It reports only what happened while away and suggests no next move (owner, 2026-11-22, shipped in PR #439). Offline starvation never drops workers below 50% of their pre-absence count (baseline); with starvation deaths (batch 2) at most 20% of the eaters can be lost, so 80% are kept.
- **Pause (decided):** pause is in-session only. Hiding or closing the app ends it, and the time away counts as normal offline time. A pause is never saved.
- **Notifications (decided):** none in the web build. A closed web page cannot detect "nest is full" or "offline cap reached". A later store build (native wrapper) may add local notifications scheduled at predicted times. The game must never depend on them.

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
| 2 Colony | Nest | Dig and feed, worker-role split, buildings | A colony forms |
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
- **Direction:** readable at arm's length on a phone. Each phase owns a palette shift. Ants are shown as countable units where the screen allows (for example, a nest cross-section that fills up), so Pillar 1 is visible. The nest scene draws only the rooms dug so far: a young nest is small and fits a phone without zooming, and each new room opens up the picture (replaces the 2× camera crop; owner, 2026-11-22). A room opening gets a quick, light animation. Detailed art direction goes to `gds-ux`.
- Constraint: solo owner, no art budget. Art must be producible with procedural/vector assets or a small icon set. [ASSUMPTION: carried from brief]

### Audio and Music

- **Baseline:** 5 synthesized sound effects, no music.
- **MVP:** sound effects for tap, dig (a crunch) and room breakthrough, hatch, battle result, phase transition and decision event. Sound effects are muted by default on mobile and respect the device's silent mode.
- **Music:** out of scope for MVP. A per-phase ambient layer is a later candidate. [ASSUMPTION]

---

## Technical Specifications

### Performance Requirements

- Fast first load is a quality goal, not a hard target (owner, 2026-11-21; this replaces the earlier 3 s first-interactive target). Terminal text renders first and the vector scene fades in when ready; later launches load from the local cache.
- Reference device for the targets below: a mid-range phone (about 2022 Android). [ASSUMPTION: device class]
- Interface responds to a tap within 100 ms. Scrolling and transitions hold 60 FPS. Game outcomes are independent of frame rate and device speed (tick rate is an architecture decision).
- Offline catch-up for a 12 h absence completes in under 500 ms on resume.
- No processing while the app is backgrounded (progress is computed on return), so the game costs no battery while closed.

### Platform-Specific Details

- Portrait, 360×640 minimum, safe-area aware. Desktop layout from 1024 px width.
- Saves are local and versioned with migrations. Existing prototype saves must migrate or be retired explicitly (architecture decides). Rotating backup is kept.
- Distribution (mobile web/PWA, native wrapper or app stores) and stack (keep, adapt or replace) go to `gds-game-architecture`.

### Asset Requirements

- Icon set covering about 20 resources and 6 buildings, a palette for each of the 6 phases, 5+ sound effects.
- Keep the initial download small. There is no hard size limit (owner, 2026-11-21; this replaces the earlier 2 MB limit).

---

## Development Epics

### Epic Structure

| # | Epic | Scope | MVP |
|---|---|---|---|
| E1 | Mobile shell and screens | Portrait layout, at most 5-tab navigation, consolidate panels | ✅ |
| E2 | Offline and check-in | 12 h cap, single offline model, 60 s full-efficiency window, return summary, in-session pause (no notifications on web) | ✅ |
| E3 | Pacing pass, Phases 1–3 | Play telemetry (local), tune against duration targets, fix integer and tick-unit issues | ✅ |
| E4 | Phase depth, Phases 1–3 | Meet the depth bar: events, upgrades, narrative beats, guard readouts | ✅ |
| E5 | Prestige rework | Full wipe except LP, Legacy upgrades, lifetime stats and victory record; save migration (#192) | ✅ |
| E6 | Phases 4–5 on mobile, with depth | Map and star map in portrait, depth bar, entropy tuning | — |
| E7 | Transcendence and ending | Ending sequence, victory record, Legacy balance | — |
| E8 | Art and audio pass | Direction from `gds-ux`, icon set, phase palettes, sound effects, countable-ant nest scene (MVP) | Partial |
| E9 | The first week digs in | Session shape and sim gates; batch 1 DIG core (DIG, FEED, bigger rooms, NEXT ROOM progress, auto-dig, a nest that shows only dug rooms); batch 2 space and food (crowding, starvation, food limit, room jobs); batch 3 flavour | ✅ (batches 1–2) |

**Sequence:** E1 → E2 → E3 ↔ E4 (iterate) → E5 → MVP playtest → **E9** (from the 2026-11-22 playtest) → E6 → E7, with E8 running in parallel from E1. Details are in `epics.md`.

---

## Success Metrics

### Technical Metrics

- All performance targets in *Technical Specifications* met on the reference device (load speed is a quality goal, not a pass/fail target).
- Zero soft-locks: an automated check that every phase guard is reachable from that phase's own production.
- **`pnpm sim` gates (first-week pacing, owner 2026-11-22).** The pacing report marks each gate pass or fail; they are tuning targets, never asserted in CI:
  1. **No idle gap over 2 min before 30 min of continuous play** (session 1: a player who plays straight through always has something useful to do). Gate for batch 1.
  2. **Phase 3 lasts to about day 7** under the *Session Shape* schedule.
  3. **Post-week check-ins:** after day 7, the median check-in is 90–120 s and every check-in offers at least one decision.
- Save migration from every shipped save version passes.

### Gameplay Metrics

Passion project: these are quality signals from playtests, not business KPIs.
- Phase 1 finished in under 5 min by at least 4 of 5 first-time playtesters.
- Session 1 lasts 45–60 min with no wait wall before about 30 min; after the first week the median check-in is 90–120 s. Every check-in offers at least one decision.
- Playtesters return voluntarily on day 2 and day 3 of the MVP.
- Measured time to first victory, compared against the target of about 4 weeks.

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
2. Session shape: decided 2026-11-22 (*Session Shape*); about 6 check-ins a day stays an assumption.
3. Differentiators (real ending, physical growth, premium-feeling reveal) not yet confirmed by the owner.
4. "At least one decision per check-in" rule.
5. Per-phase duration split of Phases 4–5 (the 4-week total and Phases 1–3 across the first week are decided).
6. Tap-share targets for Phase 1.
7. "No dominant upgrade" rule.
8. Automation unlock after 10 manual performances.
9. Offline: 24 h ceiling. (The starvation floor is decided: 50% today, 80% kept once starvation deaths ship.)
10. Number display rule (full to 999,999, then suffixes).
11. Phase Skip cannot skip a never-completed phase.
12. Second run reaches the furthest phase in at most 50% of the time.
13. Depth bar values (3 events, 4 upgrades, 2 beats per phase); 3 enemy types in Combat.
14. No art budget; music out of scope for MVP (ambient layer later); reference device class; desktop shortcuts.
15. Offline-efficiency research cost.
16. Phase 3–5 active-play minutes and ending-sequence length.
17. Wood, stone and nectar yields from Gather, Forage and Dig.
18. Target ranges of the rescaled phase goals (exact values set by tuning).
19. Phase 2 active-play target (45–70 min), derived from the session shape.

**Notes for the designer (open):**
- Tick-unit mismatch in hatch, mature and train times, and in the per-tick territory and entropy rates.
- Non-integer research cost (`antimatter: 0.1`).
- Two offline caps in the baseline (4 h and 8 h).
- Name collision with Swarm Simulator: is renaming in scope?
