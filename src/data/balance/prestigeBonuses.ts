/**
 * Legacy production bonuses (Story 3.2): what each purchase of a production
 * upgrade adds, stacking `1 + bonus × purchases`. Read by
 * `systems/PrestigeBonusSystem.ts`.
 */
export const prestigeBonusBalance = {
  egg_laying: 0.25,
  hatching: 0.25,
  food: 0.25,
  soldier_training: 0.25,
  worker_efficiency: 0.1,
} as const;
