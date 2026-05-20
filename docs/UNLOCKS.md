# THE SWARM — Developer Unlock Reference

> Internal only. Keep mystery for players.

---

## Phase Transitions

| Phase | Condition | Requires Phase |
|---|---|---|
| **COLONY** | Workers ≥ 10 | EGG_LAYING |
| **COMBAT** | Workers ≥ 15 **AND** ≥ 1 Guard assigned | COLONY |
| **EXPANSION** | Workers ≥ 20 **AND** Food ≥ 500 | COLONY |
| **SPACE** | Workers ≥ 30 **AND** Food ≥ 2,000 | EXPANSION |
| **TRANSCENDENCE** | Void Crystals ≥ 50, Antimatter ≥ 10, Dark Matter ≥ 5 | SPACE |

---

## Panels Unlocked Per Phase

| Phase | New Panels |
|---|---|
| EGG_LAYING | Click Button, Resource Panel, Event Log, Phase Indicator |
| COLONY | Worker Assignment |
| COMBAT | Soldier Panel, Battle Panel |
| EXPANSION | Map Panel, Building Panel, Expedition Panel |
| SPACE | Spaceship Panel, Exploration Panel |
| TRANSCENDENCE | (no new panels — victory achieved) |

---

## Units

### Soldiers
- **Unlock:** Phase COMBAT (soldier panel)
- **Cost:** 5 food + 1 worker → training pipeline
- **Train time:** 15 ticks (pipeline: 1/15 per tick per soldier)
- **Requires:** Worker ≥ 1, Food ≥ 5

### Scouts (sub-type of expedition units)
- **Unlock:** Phase COMBAT (recruit soldiers, they auto-split into scouts/warriors)
- Barracks Lv.1 → scouts cap = 2, Barracks Lv.2 → scouts cap = 3, warriors cap = 2

### Equipment
- **Weapon upgrade:** 10 food (×1.20 per level), max Lv.5
- **Armor upgrade:** 10 food (×1.20 per level), max Lv.5

---

## Buildings

| Building | Cost (Lv.1) | Cost Formula | Effect |
|---|---|---|---|
| **Barracks** | 100 food, 50 wood | × level | Scouts/Warriors cap |
| **Walls** | 200 stone | × level | +5% defense per level |
| **Warehouse** | 150 wood, 100 stone | × level | +25 nest capacity per level |

---

## Workers

| Role | Effect | Unlock |
|---|---|---|
| **Gather** | +2 food/tick each | Phase COLONY (worker panel) |
| **Tend** | +25% egg hatch rate each | Phase COLONY |
| **Dig** | WIP (reserved) | Phase COLONY |
| **Guard** | Required for COMBAT phase transition (+combat stats) | Phase COLONY |

---

## Expeditions

- **Unlock:** Phase EXPANSION (expedition panel)
- **Requires:** Scouts and/or Warriors available
- **Max active:** 3
- **Destinations:**

| Destination | Soldiers | Time | Loot |
|---|---|---|---|
| MEADOW 🌼 | 1 scout, 0 warrior | ~20-60 ticks | Nectar + Food |
| FOREST 🌲 | 1 scout, 0 warrior | ~20-60 ticks | Wood + Food |
| MOUNTAIN ⛰️ | 1 scout, 0 warrior | ~20-60 ticks | Stone + Food |

Risk varies by destination. Higher risk = more casualties but better loot.

---

## Space

### Spaceship
- **Unlock:** Phase SPACE
- **Lv.1 cost:** 2000 food, 500 wood, 500 stone, 200 nectar (no space resources needed!)
- **Lv.2+ require:** space resources from exploration
- **Levels:** 1-4
- **Missions:** Send to destinations, returns with space resources
- **Bootstrap path:** Run expeditions (10% chance per resource per expedition to drop voidCrystals/antimatter/darkMatter) OR build Lv.1 spaceship with basic resources.

### Space Exploration (Probes)
- **Unlock:** Phase SPACE + spaceship built (Lv > 0)
- **Requires:** Scouts ≥ 1
- **Max active:** 3
- **Destinations:**

| Planet | Type | Yields |
|---|---|---|
| MARS 🪨 | Rocky | Antimatter |
| SATURN 🪐 | Gas | Dark Matter |
| EUROPA 🧊 | Ice | Void Crystals |
| KEPLER-442B 🌍 | Habitable | Food + Void Crystals |

---

## Resources

### Basic (always available)
- **Eggs:** Click to lay. Pipeline: 1 egg → larvae every 10s per egg in pipeline
- **Food:** Workers produce. Unassigned: +1/tick, Gather: +2/tick. Consumed: -0.5/tick per worker

### Territory (EXPANSION phase)
| Resource | Source | Rate (per worker per claimed tile) |
|---|---|---|
| Wood | FOREST tiles | 0.5/tick |
| Stone | MOUNTAIN tiles | 0.5/tick |
| Nectar | MEADOW tiles | 0.5/tick |

### Space (SPACE phase)
| Resource | Source |
|---|---|
| Void Crystals | EUROPA probes, spaceship missions |
| Antimatter | MARS probes, spaceship missions |
| Dark Matter | SATURN probes, spaceship missions |

---

## Upgrade: Click Power

- **Cost:** 10 food (×1.15 per level)
- **Effect:** +1 egg per click per level

---

## Victory Condition

Reach TRANSCENDENCE phase (collect 50 void crystals, 10 antimatter, 5 dark matter).
