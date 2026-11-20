---
title: "Game Brief: THE SWARM"
status: final
created: 2026-11-20
updated: 2026-11-20
source: "Derived from code at Seven74AI/the-swarm main @ 8a0c434, then updated with owner answers (2026-11-20). [ASSUMPTION] tags mark what is still inferred."
---

# Game Brief: THE SWARM

## Executive Summary

THE SWARM is a **mobile-first** incremental game. You start as a lone ant queen laying eggs, and you end as a colony-mind that leaves physical existence behind. The arc moves through six scales of play (nest, colony, battlefield, territory, space, transcendence), and each one changes what you manage instead of just making the numbers bigger.

The experience is one of *escalating scale with a tangible core*. The colony is always countable ants, growth always has a physical cost, and the destination is a real ending, not an endless number line. Prestige makes later runs faster and adds replay value.

This is a **passion project**: quality and fun come before market reach.

A playable build of the full six-phase arc already exists (TypeScript, browser, desktop-shaped UI). **It is a prototype, not a commitment.** The owner is open to changing the design, the UI and the tech stack. This brief sets the vision, and the existing build is evidence of what works. The GDD and architecture decide what to keep.

## Vision

**Core fantasy (one sentence):** You are the queen whose single egg becomes a swarm big enough to swallow the universe.

**Elevator pitch:** An ant-colony idle game for your phone that keeps zooming out. You go from nursery to battlefield to world map to star map to singularity, and every layer is built from ants you can count.

**Feel players should leave with:** the "how did it get this big?" vertigo of a good incremental, plus pride in a colony shaped by your choices about who gathers, who digs, who fights and what to risk. [ASSUMPTION: read off the build's narrative text; not yet stated by the owner]

## Target Players & Market

- **Primary:** mobile idle players who play in short check-ins (often under a minute, several times a day) and expect offline progress, one-handed portrait play and sessions they can drop at any moment. [ASSUMPTION: session shape]
- **Secondary:** desktop-browser incremental players (the Universal Paperclips and Kittens Game crowd) who will play longer sessions. The layout should scale up for them, not be designed around them.
- **Market context:** mobile idle is huge and saturated, and ant themes are already taken (Idle Ants, Pocket Ants, The Ants: Underground Kingdom), mostly F2P with ads or gacha. The open gap is likely a *premium-feeling, reveal-driven* idle with a real ending. [ASSUMPTION: unresearched; candidate for `gds-domain-research`]

## Core Fundamentals

**Genre:** incremental / idle with light management and auto-resolved combat. Single-player.

**Core loop (as built; open to redesign):**
- *Check-in (seconds):* collect offline gains, reassign workers, answer a pending decision, queue an upgrade.
- *Mid loop:* buildings, combat drops feeding equipment and mutations, map expansion, research chains.
- *Outer loop:* reach the next phase, a new scale of play with new verbs.
- *Meta loop:* prestige to earn Legacy Points and permanent upgrades that speed up later runs.

**Gameplay pillars** (seen in the build, kept as hypotheses):
1. **Every number is an ant.** Integer resources, egg → larva → worker pipelines, nest capacity and food upkeep keep growth physical.
2. **Each phase changes the game.** Every phase adds a new kind of decision, a narrative beat and a visual identity.
3. **Allocation beats clicking.** Tapping only bootstraps the game. The skill is in splitting the workforce, and automation takes over the rote work.
4. **Growth bites back.** Risky decisions, combat losses and double-edged entropy mean scale has consequences.

## References & Differentiation

| Title | Take | Leave |
|---|---|---|
| Universal Paperclips | Scale shifts that change the game, cosmic endgame, rate-based production | Text-only austerity |
| A Dark Room (mobile port) | Revealing UI a phase at a time, terse narrative, a mobile incremental with an ending | Heavy scripted story |
| Kittens Game | Population allocation as the core skill | Spreadsheet sprawl |
| Idle Ants / Pocket Ants | Proof the ant theme works on mobile | Ad- and gacha-driven loops, no ending |
| Cookie Clicker | Tap to bootstrap, prestige upgrades | Endless tapping as a core verb |

**Differentiators:** (a) a real ending across six escalating scales, and (b) growth that stays physical (countable ants, capacity, upkeep). The edge is execution and pacing. [ASSUMPTION: the owner hasn't confirmed these]

## Scope & Next Milestone

- **Platform:** mobile first (phone, portrait, touch), desktop second. Whether it ships as mobile web/PWA, a native wrapper or app stores is open and goes to architecture. [ASSUMPTION: no store or distribution decision yet]
  - *Implications for the GDD:* design for touch and portrait, with one primary action per screen. Offline progress becomes a core feature: the build's 4 h cap at reduced efficiency may be too stingy for phone check-ins. Consider notification hooks ("your colony is full"). The ~23 desktop panels likely need redesigning into a few screens, not just reflowing.
- **Stack:** open. The current TypeScript + Vite + signals + vanilla DOM build is the baseline to beat, not a constraint. `gds-game-architecture` decides whether to keep it, adapt it or replace it.
- **Stakes:** passion project for now (owner): no launch date, revenue target or publisher. Monetization is out of scope until that changes. Design for fun, not retention metrics.
- **Team:** a solo owner with AI coding agents, working through GitHub issues → PR → CI. [ASSUMPTION: no art or audio budget]
- **Next milestone:** finish BMAD planning (GDD → UX → architecture → epics → readiness check) before building anything else.
- **MVP:** to be defined in the GDD. Working hypothesis: a phone-playable slice of the first two or three phases that tests whether check-in play is satisfying. The existing build counts as the prototype.

## Content & Direction

- **World:** an ant colony escalating from nest to surface to solar system to singularity. Narrative comes through short beats and an event log.
- **Depth before breadth (owner):** Transcendence may not be the final step, but before anything is added after it, each existing phase gets maxed out with more decisions, events, upgrades and pacing polish. The GDD should treat "make phases 1–5 feel complete" as the priority and leave post-Transcendence content as a parked roadmap item.
- **Breadth in the current build:** 6 phases, 3 decision events, 6 mutations, 8 prestige upgrades, 4 planets, 3 ship classes, 2 research trees. Time to first victory hasn't been measured.
- **Art and audio:** open. The build uses a dark earth-tone UI, per-phase color themes, emoji icons and five synthesized SFX with no music. A new direction should be defined in `gds-ux`.

## Risks & Open Questions

- **Pacing hasn't been validated.** Phase gates were tuned by "pacing nerfs" without playtest data, and mobile check-in rhythm needs different pacing anyway.
- **Saturated market** (low priority for a passion project). The ant theme on mobile is crowded with F2P titles. Only matters if the stakes change.
- **What survives prestige** (#192) still needs a decision in the GDD.
- **Thin mid-game content** for "maxed-out" phases (see Depth before breadth).
- **Stack decision** must weigh rewrite cost against keeping the ~1,300 tests and the save-migration chain.
- **Name collision** with the incremental game Swarm Simulator.
