/**
 * Scouts and warriors (Story 3.2): their food cost and the barracks level
 * that opens warriors. Read by `systems/RecruitmentSystem.ts` and
 * `actions/combat.ts`. The caps are barracks effects (`buildings.ts`).
 */
export const recruitmentBalance = {
  scoutFoodCost: 50,
  warriorFoodCost: 100,
  scoutBarracksLevel: 1,
  warriorBarracksLevel: 2,
} as const;
