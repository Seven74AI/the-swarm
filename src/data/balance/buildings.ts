/**
 * Building balance (Story 3.2, FR6): base costs, the advanced-level surcharge
 * and the effects per level. Read by `systems/BuildingSystem.ts`; the cost
 * growth and soft cap are in `progression.ts`. Tests import these. Story 3.11
 * scaled the wood, stone and nectar prices with the slower role yields, and
 * the Warehouse's room so Colony's goal needs it and Combat's needs more.
 */
export const buildingBalance = {
  /** Base cost of each building; the cost to reach a level is `floor(base × growth^level)`. */
  baseCosts: {
    barracks: { food: 1000, wood: 500, stone: 0, nectar: 0, chitin: 0, silk: 0, venom: 0 },
    walls: { food: 0, wood: 0, stone: 2000, nectar: 0, chitin: 0, silk: 0, venom: 0 },
    warehouse: { food: 0, wood: 1500, stone: 1000, nectar: 0, chitin: 0, silk: 0, venom: 0 },
    silk_weaving: { food: 0, wood: 400, stone: 0, nectar: 0, chitin: 0, silk: 4, venom: 0 },
    chitin_armory: { food: 0, wood: 0, stone: 400, nectar: 0, chitin: 4, silk: 0, venom: 0 },
    venom_lab: { food: 0, wood: 0, stone: 0, nectar: 400, chitin: 0, silk: 0, venom: 2 },
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
  warehouseNestCapacityPerLevel: 20,
} as const;
