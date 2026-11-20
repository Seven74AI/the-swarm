# THE SWARM: Development Epics

Companion to `gdd.md`. High-level stories only; `gds-create-epics-and-stories` turns these into implementable stories after UX and architecture. Each story names the pillar(s) it serves.

**Sequence:** E1 → E2 → E3 ↔ E4 (iterate) → E5 → **MVP playtest** → E6 → E7. E8 runs in parallel from E1.

---

## E1: Mobile shell and screens (MVP)

**Goal:** the game is fully playable one-handed in portrait on a phone.
**Delivers:** Controls and Input; the phase reveal (Pillar 2).

- Bottom navigation with at most 5 destinations; each phase adds or changes tabs, never a sixth. (P2)
- Consolidate the about 23 desktop panels into those destinations, per the `gds-ux` information architecture. (P2, P3)
- Primary action per screen in the thumb zone; 44 pt hit targets; tap-and-hold repeat; ×1/×10/×max steppers. (P3)
- Decision events as a bottom sheet. (P4)
- Desktop layout as a multi-column version of the same screens. (secondary audience)

**Done when:** every Phase 1–3 action works on a 360×640 touch screen without horizontal scrolling or hover.

## E2: Offline and check-in (MVP)

**Goal:** every return shows a summary with at least one actionable decision.
**Delivers:** Offline progress decision (12 h cap); the check-in loop.

- Replace the two baseline caps (4 h and 8 h) with one 12 h cap, upgradable to 24 h. (P1)
- Efficiency chain: 50% → 75% via Phase 2–3 research (per run); 75% → 100% and 12 h → 24 h cap via Legacy upgrades. Replaces Temporal Resonance / Chrono Synchronization and migrates saves that own them. (P3)
- Return summary sheet: elapsed time, gains, events waiting, one suggested next action. (P3)
- Offline starvation floor (workers never below 50% of their pre-absence count). (P4)
- Opt-in local notifications: nest full, cap reached. (check-in loop)

**Done when:** a 12 h absence resolves in under 500 ms and the summary offers at least one decision.

## E3: Pacing pass, phases 1–3 (MVP)

**Goal:** hit the Difficulty Curve targets.
**Delivers:** Difficulty Curve; Number Balancing.

- Local, privacy-respecting play telemetry: time per phase, check-in length, decisions per check-in. (all)
- Resolve the tick-unit ambiguity in the hatch, mature and train times. (P1)
- Make every cost an integer (fix `antimatter: 0.1`). (P1)
- Automated reachability check: each guard is reachable from its phase's own production. (soft-lock rule)
- Tune Phase 1 to 3–5 min, Phase 2 to day 1, Phase 3 to days 2–3. (P2)
- Remove the Colony → Expansion alternate route; Combat becomes mandatory. Update E2E seeds that rely on it. (P2)

**Done when:** a simulated six-check-ins-per-day player meets the phase targets for Phases 1–3.

## E4: Phase depth, phases 1–3 (MVP)

**Goal:** each MVP phase meets the depth bar.
**Delivers:** Level Progression depth bar; Upgrade Trees.

- At least 3 decision events unique to each phase. (P2, P4)
- At least 4 competing purchases per phase. (P3, P4)
- Entry and near-guard narrative beats for each phase. (P2)
- Guard-progress readout on every phase. (check-in loop)
- Automation targets ("keep N in training") for each automated verb. (P3)
- Combat interest bar: at least 3 enemy types with traits visible before battle, a battle summary explaining the result, and army size kept a trade-off by food upkeep and worker cost. (P2, P4)

**Done when:** a depth-bar checklist passes for Phases 1, 2 and 3.

## E5: Prestige rework (MVP)

**Goal:** a clean-run prestige model (resolves #192).
**Delivers:** Prestige and Reset Mechanics.

- Prestige wipes everything except LP, Legacy upgrades (including offline upgrades), lifetime stats and the victory record. (P2)
- Keep the victory record as an achievement only, with no gameplay effect.
- Save migration for existing saves that hold space resources across prestige. (technical)
- `phase_skip` cannot skip a never-completed phase. (P2)

**Done when:** a second run starts with zero resources except those granted by Legacy upgrades, LP bonuses apply, and migrated saves load.

## E6: Phases 4–5 on mobile, with depth (post-MVP)

**Goal:** Expansion and Space meet the depth bar on a phone.
**Done when:** both phases pass the depth-bar checklist and the Week 2–3 targets in a simulated run.


- 8×8 map and star map usable in portrait. (P2)
- Depth bar for Expansion and Space. (P2, P4)
- Entropy tuning so dark matter remains a real trade-off. (P4)
- Spaceship and planet flow tuned to the Week 2–3 target. (P2)

## E7: Transcendence and ending (post-MVP)

**Goal:** the first run ends in a real, satisfying victory.
**Done when:** reaching Transcendence plays the ending and offers prestige as the replay path.


- Ending sequence and narrative close. (P2)
- Ending sequence triggers on Transcendence and offers prestige as the replay path. (meta loop)
- Legacy tree balance against the "second run in at most 50% of the time" target. (meta loop)

## E8: Art and audio pass (partly MVP)

**Goal:** each phase looks and sounds distinct and readable on a phone.
**Done when:** every phase has its palette, the icon set covers all resources and buildings, and the MVP sound effects ship.


- Direction from `gds-ux`; icon set for about 20 resources and 6 buildings. (P1)
- Palette per phase, applied on phase entry. (P2)
- MVP sound effects: tap, hatch, battle result, phase transition, decision; muted by default on mobile.
- Countable-ant visualization (for example, a filling nest cross-section). (P1)
