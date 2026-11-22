---
title: 'Game Brainstorming Session: digging in the first days (#436)'
date: '2026-11-22'
author: 'Seven74'
version: '1.0'
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
---

# Game Brainstorming Session

## Session Info

- **Date:** 2026-11-22
- **Facilitator:** Game Designer Agent
- **Participant:** Seven74
- **Topic:** Issue #436: tap-to-dig in the first days, a "next room in…" progress bar, and nest scene framing on mobile

---

## Brainstorming Approach

**Selected mode:** Guided

**Technique sequence:**
1. Constraint Box: one thumb, 390 px, a 30-second session (frames everything)
2. Verbs Before Nouns: the thumb's actions when digging
3. Game Feel + Toy Before Game: one dig tap, and a nest worth poking with no goal
4. Failure State Design: the player who never taps
5. Progression Curve Sculpting: from hand-digging to diggers across the first week
6. Reward Schedule Architecture: the "next room in…" bar and what a room gives

**Focus areas:** core loop of the first hour, game feel, progression (tapping → automation), feedback that makes progress visible, mobile framing of the nest scene.

**Grounding facts:** start capacity 25; Colony goal 50 workers + 1 guard; one digger ≈ 27 h per room today; young-colony camera at 2× hides the workers chamber; the party chose hands-on digging in week 1, timers after. (Plan revised in party mode: Constraint Box first, Game Feel + Toy merged, Failure State Design added.)

_Ideas will be captured as we progress through the session._

## Ideas Generated (running list, 35 ideas)

**[Constraint #1]**: The DIG button
_Core Loop_: A DIG button sits where LAY EGG does. Each press digs the next room a bit further; the nest scene shows the dirt giving way.
_Novelty_: Reuses the one verb players already know from Phase 1 (one big button), so Phase 2 opens with a familiar thumb motion that now builds space instead of eggs.
_Source:_ Seven74 (Constraint Box). No reference game in mind: riffing from scratch.

**[Constraint #2]**: Fixed chunks per press
_Core Loop_: One DIG press removes one fixed chunk of dirt; roughly 20 presses finish a room. Progress is countable and predictable.
_Novelty_: A room becomes a bite-sized goal that fits a 30-second session, unlike today's invisible ~27 h timer.
_Source:_ Seven74 picked (a) over speed-boosts, food cost and a shared LAY/DIG button.

**[Constraint #3]**: Dirt becomes stone (Samus)
_Core Loop_: Every chunk dug comes out as stone. Digging builds rooms and pays toward the Warehouse, which costs stone.
_Novelty_: One verb feeds two goals, so the thumb's work is never wasted.

**[Feel #4]**: Rhythm bonus (Link)
_Core Loop_: Steady tapping grows each chunk a little, with a crunch whose pitch rises; stopping resets the streak.
_Novelty_: Turns 20 presses into a rhythm, not a chore.

**[Progression #5]**: Diggers make each press bigger (Indie)
_Core Loop_: Each worker on DIG adds to the chunk size. Early on the player digs; later the diggers carry it and the button matters less.
_Novelty_: The tap-to-automation handover happens inside one formula, with no extra system.

**[Toy #6]**: Hard soil and finds (Sally)
_Core Loop_: Sometimes the dig hits a pebble (extra presses) or breaks into a find: fungus spores, a seed, an old tunnel.
_Novelty_: Small surprises keep the thumb curious.

**[Progression #7]**: Rooms grow (John)
_Core Loop_: Each room takes more presses than the last (5, 8, 12…): the first session flies, then slows as diggers take over.
_Novelty_: The difficulty curve is built into the dig itself.

_Seven74 kept all five team build-ons (#3–#7)._

_Code fact (src/systems/ResourceSystem.ts): one room = +1 nest capacity = one more larva may mature into a worker. When the nest is full, larvae wait in the brood._

**[Reward #8]**: A room holds several ants (Seven74: yes)
_Core Loop_: Finishing a room adds several capacity, not +1, so each dug room is a real jump toward the 50-worker goal.
_Novelty_: Makes ~20 presses worth it; one room ≈ a visible chunk of the goal.

**[Reward #9]**: Rooms with a job (Seven74: maybe, parked)
_Core Loop_: When a room opens, the player chooses what it becomes (brood room, pantry, fungus room…).
_Novelty_: Adds a choice to each room; undecided, revisit later.

**[Reward #10]**: The room-opening moment (Seven74: a quick animation, light touch)
_Core Loop_: A short animation when the wall breaks through (dirt falls, the chamber outline appears).
_Novelty_: Marks the payoff without slowing the player down.

_Dropped by Seven74: "next room is revealed" teaser._

**[Verb #11]**: Feed the brood
_Core Loop_: Tap the queen or the larvae to speed up hatching while the brood is waiting.
_Novelty_: Gives the thumb something useful to do while rooms are being dug.

**[Verb #12]**: Defend the nest
_Core Loop_: Something pokes into the nest (a beetle, a spider); tap it to chase it off.
_Novelty_: A small, active threat in Phase 2 that can foreshadow Phase 3 combat.

**[Verb #13]**: Collect finds
_Core Loop_: Finds and dropped resources sit in the scene until tapped to pick up.
_Novelty_: Rewards looking at the nest scene, not just the buttons. (Seven74 wrote "correct", read as "collect".)

_Seven74 kept Feed, Defend and Collect; Forage not picked._

**[Verb #14]**: Intruders (Defend, developed: Seven74 kept a + b + c + d)
_Core Loop_: A beetle or spider crawls in. A few taps chase it off (a). Ignored, it eats food or blocks a tunnel until dealt with (b). Guards fight it on their own, and tapping helps them (c). Chasing it off drops a reward such as chitin, a find or food (d).
_Novelty_: Gives the Colony goal's guard a visible job in Phase 2 and teaches combat before Phase 3, with a small cost for ignoring it.
_Note:_ chitin today is a Phase 3 combat resource; dropping it earlier is fine (no catch-22: produced before it is used).

**[Verb #15]**: Feed fills the room you dug (Feed, developed: Seven74 kept a + d)
_Core Loop_: Tapping the brood speeds larvae toward becoming workers (a), but only while a room is free (d). With the nest full, Feed is greyed out and DIG is the move.
_Novelty_: DIG and Feed take turns: dig a room, feed ants into it, dig again. Two buttons, one rhythm.

**[Loop #16]**: The first-hour loop (emerging from #1–#15)
_Core Loop_: DIG a room (stone falls out) → FEED larvae into it → intruders and finds interrupt (tap to defend, tap to collect) → room full, DIG again. Diggers slowly take over the DIG side.
_Novelty_: Every part happens in the nest scene, and the handover to automation is built in (#5).

**[Feel #17]**: The dig press (Seven74)
_Core Loop_: Each press: a crunch or scraping sound, a small screen shake and a puff of dirt particles. When the room breaks through: a vibration.
_Novelty_: Physical, short feedback that makes each of the ~20 presses feel like it moved earth.
_Tech note:_ the web vibration API works on Android Chrome but not in iPhone Safari; iPhone haptics need a workaround (a hidden switch toggle, Safari 17.4+) or a sound fallback.

**[Feel #18]**: Ants visibly digging (Seven74: awesome, not needed)
_Core Loop_: Little ants hack at the dig face while the player presses, instead of the dirt just vanishing.
_Novelty_: Ties the button to the creatures; nice-to-have.

**[Failure #19]**: Tapping is a boost, never required (Seven74: a)
_Core Loop_: A player who never presses DIG still gets rooms: the diggers dig them, only slower. No nudges, no pressure, no penalty.
_Novelty_: Keeps the idle promise intact: the hands-on first week makes things faster, it never gates progress. (Rejected: pulsing nudges, hungry waiting larvae, a hard stop.)

**[Progression #20]**: Auto-dig you unlock (Seven74: d, changed from a)
_Core Loop_: Early on the player digs by hand. At some point they **buy** auto-dig (like Phase 1's auto egg-layer); from then on the diggers take over and the DIG button steps back.
_Novelty_: The handover is a reward the player chooses and pays for, not something that just fades. Fits the existing automation pattern (Story 4.10). (Rejected: fade-out on its own, always-useful press, button changing job.)

**[Reward #21]**: Next room progress, in two places (Seven74)
_Core Loop_: In the nest scene, a crack in the dirt wall grows as the room gets closer. In the nest panel, a bar fills up with the time left ("NEXT ROOM IN 4M").
_Novelty_: The scene shows it, the panel tells it exactly. Fixes the playtest finding that digging progress was invisible. (Not needed: splitting the player's presses from the diggers' share.)

**[Scene #22]**: The nest shows only what you've dug (Seven74: c)
_Core Loop_: A young nest is small and surrounded by solid dirt, so it fits a phone screen without zooming. Each new room opens up the picture; the nest literally grows on screen.
_Novelty_: Replaces the 2× camera crop with growth you caused. The scene becomes the progress bar for the whole colony. (Not chosen: fit-all, follow-cam, drag to pan, a taller scene.)

**[Scene #23]**: Rework the wrapper around the scene (Seven74)
_Core Loop_: Keep the drawing, rework the panel that holds it (goal rows, brood control, buttons, next-room bar) for the digging loop on a phone.
_Novelty_: Mockups requested to react to.

_Mockups for #22/#23 (Design canvas, 4 phone screens): https://claude.ai/artifact/Rs3RWvuwqrsbx7p5CWEsNp. Screens: young nest digging the next room; a beetle and a find; the room breaks through; later, auto-dig owned._

**[Long run #24]**: Crowding replaces the headcount penalty (Seven74: yes)
_Core Loop_: Today `workerEfficiency` cuts every worker's gathering above 500 workers (≈80% at 1,000, 57% at 2,000) while upkeep stays the same, invisibly. Instead, the slowdown depends on ants per room: a packed nest works slower, and digging rooms relieves it. Shown in the scene and the NEXT ROOM strip ("CROWDED · −20% WORK").
_Novelty_: DIG stays meaningful for the whole game, the penalty becomes visible and thematic, and the swarm can grow to thousands while the player keeps digging. Also: 300–400 ants is too small for THE SWARM; numbers should scale to thousands and beyond (feeds #438).

**[Long run #25]**: Starvation kills (Seven74)
_Core Loop_: When the colony eats more food than it has, ants start to die, picked at random among workers, larvae and soldiers.
_Novelty_: Food becomes a real stake. Today (code) an empty store only stops soldier training: food clamps at 0 and nobody dies; the "starving colony thins" in the scene is drawing only. An offline floor (`OFFLINE_WORKER_FLOOR_SHARE` = 0.5) already caps losses during an absence.

**[Long run #25, developed]**: Starvation rules (Seven74)
- A warning before anyone dies (e.g. "FOOD RUNS OUT IN 2M").
- Who dies: only those who eat, at random among workers and soldiers. Eggs and larvae eat nothing, so they never starve (Seven74). The queen is always safe.
- While away: at most 20% of the colony can be lost (today's floor keeps 50%; becomes 80%).
- Speed: shrink to fit (Seven74: a). Just enough eaters die to bring consumption back to production, spread over time (e.g. one death every few seconds), so the player can react.
- Code fact: only workers and soldiers eat (`upkeepFoodPerSec` 0.5 per worker, plus army upkeep); eggs and larvae eat nothing, so a brood death doesn't shrink the shortfall.

**[Building #26]**: A building to set the starvation order (Seven74)
_Core Loop_: In some later phase, a building lets the player choose who goes hungry first (workers or soldiers).
_Novelty_: Turns a random punishment into a decision the player can plan for; a reason to build it.

### Party review of the 26 ideas (accepted by Seven74)

1. **Three batches (Indie):** (1) DIG core: DIG with chunks, FEED, bigger rooms, NEXT ROOM bar, auto-dig, nest draws only dug rooms; (2) crowding + starvation together (one system: how many ants the nest and the food can hold); (3) later: intruders, finds, rhythm bonus, priority building.
2. **FEED is a tap on the brood in the scene (Sally);** DIG stays the single main button in one place. The mockups' two-button row changes accordingly.
3. **Offline-safe formulas (Cloud Dragonborn):** crowding and shrink-to-fit starvation are formulas of the current state, so the 10 s catch-up steps match live play.
4. **Safety ships with deaths (John):** the warning and the 20% offline limit ship together with starvation deaths, or not at all.
5. Intruders use the save's seeded randomness (Link). Batch 1 gets the sim gate: no idle gap > 2 min before 30 min of continuous play (Mary).

### Exploration party: four threads (Seven74 kept #27, #28, #30–#33; #29 in revision)

**[Scene #27]**: Crowding spills into the tunnels (Sally). An over-full room's dot cloud spills into tunnels and ants queue in corridors: the jam is visible before the "CROWDED" label. (Scene already uses dot clouds: ≤1,500 dots, ≤50 animated ants, counts always as text.)
**[Moment #28]**: Milestone pull-out (Samus). At 1,000 and 10,000 ants the camera shows the whole anthill from the side for two seconds: "THE SWARM."
**[Room #29]**: Room jobs, one tap from three when a room opens (Indie; John: max three, a plain room is always fine). Jobs kept by Seven74: **Pantry** (starvation warns sooner and bites slower), **Larder** (stores extra food), **Gallery** (holds twice as many). Dropped: Quarters (soldiers ignoring crowding), Nursery (would need to know which ant is in which room). All three jobs are colony-wide effects counted by rooms, so no ant has a location.
**[Story #30]**: Event lines for firsts (Samus): first room "THE QUEEN'S CHAMBER IS NO LONGER THE WHOLE WORLD."; first crowding "THE TUNNELS ARE PACKED. NO ONE CAN WORK."; first starvation death "A WORKER DID NOT WAKE UP."
**[Story #31]**: Those lines are the tutorial (Mary): each appears once, when the rule first touches the player.
**[Economy #32]**: Sharper mandibles (Link): a cheap early stone upgrade making each DIG press bigger. Kept in check by rooms growing (#7) (Cloud).
**[Economy #33]**: Reinforced rooms (John): a late stone sink; reinforcing old rooms so they hold more ants.

**[Rule #34]**: Everyone takes up room (Seven74)
_Core Loop_: Crowding counts every creature in the nest: workers, soldiers, eggs and larvae (the queen aside). A full nest slows everyone, and the brood fills space too.
_Novelty_: One simple rule. Note: today capacity counts workers only (larvae wait when the nest is full); counting the brood changes how laying and maturing interact with space.


**[Economy #35]**: A food storage limit (Seven74: a)
_Core Loop_: The nest can store only so much food; each Larder room raises the limit. Food past the limit is lost.
_Novelty_: Food becomes something to manage, and gives the Larder its meaning. Today food has no cap in the code. Ties into the offline summary ("food stopped at the limit") and the resource strip's capped state (▲ in warn).

---

## Themes and Patterns

- **Everything happens in the nest scene:** digging, feeding (tap the brood), intruders, finds, crowding, milestones. No menus for the core loop.
- **One big button carries over from Phase 1:** LAY EGG becomes DIG; tapping is a boost, never required (#19).
- **Automation is earned:** hand-digging in week 1, then a bought auto-dig (#20).
- **Space is the long-run spine:** crowding (#24, #34) keeps DIG meaningful for the whole game and lets the swarm reach thousands.
- **Food becomes a real stake:** starvation that shrinks the colony to fit (#25), a food limit raised by Larders (#35), with warnings and an offline cap.
- **Rules teach themselves:** one event line the first time each rule touches the player (#30, #31).

## Promising Combinations

- **The first-hour loop (#16):** DIG (#1, #2, #4, #17) → stone (#3) → room opens (#8, #10) → feed larvae into it (#15) → dig again; progress shown as a crack plus a timed bar (#21).
- **Space and food as one system:** crowding (#24, #34) + starvation (#25) + food limit (#35) + room jobs Pantry, Larder, Gallery (#29), all formulas of the current state so offline catch-up matches live play.
- **Stone loop:** digging makes stone (#3), stone buys sharper mandibles (#32) and reinforced rooms (#33), held in check by rooms growing (#7).

## Build order (party, accepted)

1. **Batch 1, DIG core:** DIG with chunks, FEED as a tap on the brood, bigger rooms, NEXT ROOM progress, auto-dig, nest draws only dug rooms. Sim gate: no idle gap > 2 min before 30 min of continuous play.
2. **Batch 2, space and food:** crowding, starvation (with the warning and the 20% offline cap shipped together), food limit, room jobs.
3. **Batch 3, flavour:** intruders (seeded randomness), finds, rhythm bonus, priority building, milestone pull-out.

## Session Summary

### Most Promising Concepts

**Top pick: the first-hour DIG loop (#16).** DIG with fixed chunks, stone falling out, a room that holds several ants, FEED as a tap on the brood, a crack plus a timed NEXT ROOM bar, then a bought auto-dig. It removes the Phase 2 capacity wall that ended the playtest and gives the first session its action.

**Runner-up: space and food as one system (#24, #25, #34, #35, #29).** Crowding instead of the invisible headcount penalty, starvation that shrinks the colony to fit, a food limit and room jobs. It answers "how does it hold for the long run?" and lets the swarm reach thousands.

**Honorable mention: rules that teach themselves (#30, #31).** One event line the first time each rule touches the player replaces tooltips.

### Key Insights

- The playtest wall was the design working as written: capacity came almost only from an expensive Warehouse and an invisible ~27 h-per-room dig.
- The current scale (goals of 10–80 workers, a penalty above 500) is far too small for a game called THE SWARM.
- Starvation does nothing today (food clamps at 0); making it real needs the warning and an offline cap in the same release.
- Every new rule must be a formula of the current state so the 10 s offline catch-up matches live play.
- Tapping must stay a boost, never a requirement, to keep the idle promise.

### Recommended Next Steps

1. Fold the decisions into the GDD with `gds-correct-course` (#438): session shape, scale, capacity, crowding, starvation, food limit.
2. Update the nest mockups to the party's change (DIG as the single main button, tap the brood to feed), then write batch 1 as stories and issues.
3. Prototype the DIG press (Link): one button, a dirt puff, a crunch; check it's fun in ten seconds before building the rest.

---

## Session Complete

**Date:** 2026-11-22
**Duration:** Brainstorming session
**Participant:** Seven74

### Output

This brainstorming session generated:

- 35 raw ideas
- 3 developed concepts (first-hour DIG loop; space and food as one system; rules that teach themselves)
- 6 emerging themes

### Document Status

Status: Complete
Steps Completed: [1, 2, 3, 4]
