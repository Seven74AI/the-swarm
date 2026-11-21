/**
 * Building balance (Story 3.2, FR6): base costs, the advanced-level surcharge
 * and the effects per level. Read by `systems/BuildingSystem.ts`; the cost
 * growth and soft cap are in `progression.ts`. Tests import these.
 */
export const buildingBalance = {
  /** Base cost of each building; the cost to reach a level is `floor(base × growth^level)`. */
  baseCosts: {
    barracks: { food: 100, wood: 50, stone: 0, nectar: 0, chitin: 0, silk: 0, venom: 0 },
    walls: { food: 0, wood: 0, stone: 200, nectar: 0, chitin: 0, silk: 0, venom: 0 },
    warehouse: { food: 0, wood: 150, stone: 100, nectar: 0, chitin: 0, silk: 0, venom: 0 },
    silk_weaving: { food: 0, wood: 40, stone: 0, nectar: 0, chitin: 0, silk: 4, venom: 0 },
    chitin_armory: { food: 0, wood: 0, stone: 40, nectar: 0, chitin: 4, silk: 0, venom: 0 },
    venom_lab: { food: 0, wood: 0, stone: 0, nectar: 40, chitin: 0, silk: 0, venom: 2 },
  },
  /** From this level on, barracks, walls and warehouse also cost combat resources. */
  advancedFromLevel: 5,
  /** Base of that combat-resource surcharge (grows like any cost). */
  advancedBaseCost: 1,
  /**
   * Barracks caps on scouts and warriors: `scouts` from the scout level, then
   * `warriors` from the warrior level (`recruitment.ts`, Lv.1 and Lv.2).
   */
  barracksCaps: {
    scouts: { scoutsCap: 2, warriorsCap: 0 },
    warriors: { scoutsCap: 3, warriorsCap: 2 },
  },
  /** Walls: defence share per level. */
  wallsDefensePerLevel: 0.05,
  /** Warehouse: nest capacity per level. */
  warehouseNestCapacityPerLevel: 25,
} as const;
