# THE SWARM — Domain Context

## Core Concepts

### Nest Capacity
The maximum number of workers the colony can support. When workers reach capacity, the `larvaPipeline` is blocked — existing workers continue normally, but no new workers hatch until capacity is expanded. This makes `nestCapacity` a real gameplay mechanic (previously cosmetic/dead code).

Capacity is expanded via:
- **Dig workers**: +1 capacity per second per worker (integer-only accumulation, 20 ticks at 50ms = +1)
- **Warehouse building**: +25 per level (soft-capped after Lv.5 via `softCapEffectiveness`)
- **"Expand" decision**: +10 one-time from DecisionSystem

Base capacity: 25. Reset to 25 on prestige.

### Workers
The ant population. Workers consume 0.5 food/sec each (linear). They can be assigned to:
- **Gather**: produce food
- **Tend**: increase egg hatch rate
- **Dig**: increase nest capacity
- **Guard**: soldiers for combat
- **Researchers**: research projects

Unassigned workers produce at half gather rate. Worker efficiency follows a diminishing-returns curve (`1/(1 + 0.0005 × (workers − 500))` for workers > 500).

### Phases
6 sequential phases: EGG_LAYING → COLONY → COMBAT → EXPANSION → SPACE → TRANSCENDENCE. Phase transitions are gated by resource/worker thresholds and battles. Each phase unlocks new panels, mechanics, and resources.

### Pipelines
Rate-based O(1) processing: `eggPipeline`, `larvaPipeline`, `soldierPipeline`. Each has `count` (rate) and `progress` (accumulated). No per-item timers.

### Prestige
Reset loop: sacrifice all progress for Legacy Points. LP give +2% production each (additive). Prestige tree has 8 upgrades costing 57 LP total. Requires all buildings Lv.5 + 100K food lifetime.

### Combat Resources
Dropped by enemies in the COMBAT phase. Used for crafting, equipment upgrades, and colony mutations.
- **Silk**: spider drop. Used for armor (soldier defense) and Silk Weaving building.
- **Chitin**: beetle/scorpion drop. Used for weapon (soldier strength) and Chitin Armory building.
- **Venom**: scorpion drop. Used for poison damage (combat DoT) and Venom Lab building.

### Equipment
Soldier upgrades purchased with combat resources. `weapon` (chitin) → strength, `armor` (silk) → defense + HP. Upgraded via dedicated buildings.

### Colony Mutations
One-time permanent bonuses purchased with combat resources. Stacking upgrades (e.g. +10% gather, +1 soldier speed, faster larvae hatching).

### Expeditions
Send scouts to map tiles (EXPANSION phase) to harvest resources. Tiles yield: Forest → wood + silk, Mountain → stone + chitin, Meadow → food + venom. Enemy Nests require combat first, then loot.

### Resources
Integers only (`Math.floor()`). Food, wood, stone, nectar (phases 1-4). Void crystals, antimatter, dark matter (phase 5+).