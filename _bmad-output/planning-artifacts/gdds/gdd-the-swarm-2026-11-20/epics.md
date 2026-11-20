# THE SWARM: Development Epics

Companion to `gdd.md`. High-level stories only; `gds-create-epics-and-stories` turns these into implementable stories after UX and architecture.

Every epic has the same shape: **Goal**, **Delivers** (the `gdd.md` sections it implements), stories, and **Done when** (testable as invariants). Each story ends with the pillar(s) it serves (P1–P4), or with *check-in loop* (the structural requirement "respect the check-in", which is not a pillar), *meta loop* or *technical*.

**Sequence:** E1 → E2 → E3 ↔ E4 (iterate) → E5 → **MVP playtest** → E6 → E7. E8 runs in parallel from E1.

---

## E1: Mobile shell and screens (MVP)

**Goal:** the game is fully playable one-handed in portrait on a phone.
**Delivers:** *Controls and Input*; the phase reveal (Pillar 2).

- Bottom tab bar with at most 5 destinations; each phase adds or changes tabs but never adds a sixth. (P2)
- Consolidate the 23 desktop panels into those destinations, following the `gds-ux` information architecture. (P2, P3)
- One primary action per screen in the thumb zone; hit targets at least 44×44 pt; tap-and-hold repeat on buy and assign controls; steppers with ×1, ×10 and ×max toggles. (P3)
- Decision events shown as a bottom sheet that pauses its own timer while the app is backgrounded. (P4)
- Desktop layout: the same screens in two or three columns. (secondary audience)

**Done when:** every Phase 1–3 action can be completed on a 360×640 touch viewport with no horizontal scrolling and no hover-only information, and no phase shows more than 5 tabs.

## E2: Offline and check-in (MVP)

**Goal:** every return shows a summary with at least one decision worth making.
**Delivers:** *Economy and Resources* (offline progress decision: 12 h cap, efficiency, summary, notifications); the offline efficiency chain in *Meta-Progression*; the check-in loop in *Core Gameplay Loop*.

- Replace the two baseline offline caps (4 h and 8 h) with a single 12 h cap that upgrades can raise to 24 h. (check-in loop)
- Offline efficiency chain: base 50%; 50% → 75% through Phase 2–3 research (wiped on prestige, re-bought each run); 75% → 100% and the 12 h → 24 h cap raise through Legacy upgrades (kept on prestige). Replaces Temporal Resonance / Chrono Synchronization and migrates saves that own them. (check-in loop, technical)
- Return summary sheet: elapsed time, resources gained, and the one most useful next action (an allocation change or an affordable upgrade). Decision events fire only while the game is open and never queue offline, so the summary does not rely on them. (check-in loop)
- Offline starvation floor: offline starvation never drops workers below 50% of their pre-absence count. (check-in loop; softens P4 offline)
- Opt-in local notifications, off by default: "nest is full" and "offline cap reached". (check-in loop)

**Done when:** a 12 h absence resolves in under 500 ms on resume; offline gains are integers and never exceed what the capped duration would produce at the current efficiency; workers never fall below the starvation floor; no decision event is generated offline; and the summary always names at least one available allocation change or affordable upgrade.

## E3: Pacing pass, phases 1–3 (MVP)

**Goal:** Phases 1–3 hit the *Difficulty Curve* targets.
**Delivers:** *Difficulty Curve*; *Number Balancing*; the Phase 2 basic-resource rule in *Economy and Resources*; the Combat-mandatory decision in *Player Progression*.

- Local, privacy-respecting play telemetry: time per phase, check-in length, decisions per check-in. (P1–P4, check-in loop)
- Resolve the tick-unit ambiguity in the hatch, mature and train times. (P1)
- Make every cost an integer (fix `antimatter: 0.1`). (P1)
- Phase 2 sources for basic resources: Gather yields food plus wood, the new Forage role yields nectar, and Dig yields nest capacity plus stone. Without these, no building is buyable in the MVP. (P1, P3)
- Automated reachability check: every phase guard is reachable from that phase's own production, with no prestige. (soft-lock rule, technical)
- Tune Phases 1–3 to the *Difficulty Curve* targets: Phase 1 in 3–5 min of active play, Phase 2 in 20–40 min of active play within day 1, Phase 3 over days 2–3. (P2)
- Remove the Colony → Expansion alternate route so Combat is mandatory; update the E2E seeds that rely on it. (P2)

**Done when:** a simulated player checking in about 6 times a day meets the real-time targets for Phases 1–3; the reachability check passes for every guard; every resource and cost is an integer; wood, stone and nectar each increase in Phase 2 from worker roles alone; and Expansion cannot be entered without passing through Combat.

## E4: Phase depth, phases 1–3 (MVP)

**Goal:** each MVP phase meets the depth bar.
**Delivers:** the depth bar and the Combat interest bar in *Level Progression*; *Upgrade Trees*; *Automation Systems*.

- At least 3 decision events unique to each phase, firing only while the game is open. (P2, P4)
- At least 4 upgrades or buildings per phase competing for that phase's currencies, none strictly dominant. (P3, P4)
- A narrative beat on entry to each phase and one near its guard. (P2)
- A guard-progress readout in every phase. (check-in loop)
- A player-set automation target (for example, "keep N in training") for each automated verb. (P3)
- Combat interest bar: at least 3 enemy types with traits visible before battle, a battle summary explaining the result, and army size kept a trade-off by food upkeep and worker cost. (P2, P4)

**Done when:** the depth-bar checklist passes for Phases 1, 2 and 3, and Phase 3 also passes the Combat interest bar checklist.

## E5: Prestige rework (MVP)

**Goal:** a clean-run prestige model (resolves #192).
**Delivers:** *Prestige and Reset Mechanics*; the Phase Skip review in *Meta-Progression*.

- Prestige wipes everything except LP, purchased Legacy upgrades (including the offline upgrades), lifetime statistics and the victory record. (P2)
- Keep the victory record as a permanent record and achievement only; it does not skip, unlock or shortcut anything. (meta loop)
- Save migration for existing saves that carry space resources across prestige. (technical)
- Phase Skip cannot skip a phase the player has never completed. (P2)
- Production bonus based on LP earned across all runs, not LP currently held, so spending LP never lowers it. (meta loop)

**Done when:** after prestige, every resource, building, research, mutation, equipment, territory and ship is reset except what Legacy upgrades grant; LP, Legacy upgrades, lifetime statistics and the victory record are unchanged; spending LP never lowers the production bonus; Phase Skip never lands past a phase that was never completed; and saves from every shipped version migrate and load.

## E6: Phases 4–5 on mobile, with depth (post-MVP)

**Goal:** Expansion and Space meet the depth bar on a phone.
**Delivers:** *Level Types* and the depth bar in *Level Progression* for Phases 4–5; the Phase 4–5 rows of *Difficulty Curve*; *Controls and Input* for the map and star map.

- The 8×8 surface map and the star map usable one-handed in portrait. (P2)
- Depth bar for Expansion and Space. (P2, P4)
- Entropy tuning so dark matter remains a real trade-off. (P4)
- Resolve the tick-unit ambiguity in the per-tick territory yield and entropy rates (the Phase 4–5 counterpart of the E3 story). (P1)
- Spaceship and planet flow tuned to the Weeks 2–3 target. (P2)

**Done when:** Phases 4 and 5 each pass the depth-bar checklist, every map and star-map action works on a 360×640 touch viewport, and a simulated run meets the Days 4–7 (Expansion) and Weeks 2–3 (Space) targets.

## E7: Transcendence and ending (post-MVP)

**Goal:** the first run ends in a real, satisfying victory.
**Delivers:** *Win/Loss Conditions* (win); the Transcendence row of *Level Types* and *Difficulty Curve*; the second-run target in *Prestige and Reset Mechanics*; the Legacy tree in *Meta-Progression*.

- Ending sequence: the narrative close of the run. (P2)
- Reaching Transcendence plays the ending sequence, records the victory and offers prestige as the replay path. (meta loop)
- Legacy tree balanced against the target of a second run reaching the first run's furthest phase in at most 50% of the time. (meta loop)

**Done when:** reaching Transcendence always plays the ending, records the victory and offers prestige; and a simulated second run reaches the first run's furthest phase in at most 50% of the first run's time.

## E8: Art and audio pass (partly MVP)

**Goal:** each phase looks and sounds distinct and readable on a phone.
**Delivers:** *Art Style*; *Audio and Music*; *Asset Requirements*.

- Art direction from `gds-ux`; an icon set for about 20 resources and 6 buildings. The icons for Phase 1–3 resources and buildings are MVP. (P1)
- A palette for each phase, applied on phase entry. The Phase 1–3 palettes are MVP. (P2)

*MVP scope of E8:* Phase 1–3 icons and palettes plus the MVP sound effects. The countable-ant visualization and the Phase 4–6 assets are post-MVP. [ASSUMPTION: MVP split]
- MVP sound effects for tap, hatch, battle result, phase transition and decision event; muted by default on mobile and respecting the device's silent mode. (MVP; P2)
- Countable-ant visualization (for example, a nest cross-section that fills up). (P1)

**Done when:** each of the 6 phases applies its own palette on entry; every resource and building has an icon; and the MVP sound effects play on their events, start muted on mobile and stay silent in the device's silent mode.
