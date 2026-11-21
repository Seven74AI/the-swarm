/**
 * Converter balance (Story 3.6): the inputs and outputs of each conversion
 * step, what caps its rate, and the Particle Lab that the antimatter step
 * needs. Read by `systems/ResourceConversionSystem.ts`; names and the
 * research each step needs stay there. Rates are runs per second; a fraction
 * carries to the next step (Story 2.5).
 */
export const conversionBalance = {
  voidCrystalSynthesis: {
    inputs: { stone: 5, nectar: 2 },
    outputs: { voidCrystals: 1 },
    /** One run a second for every this many researchers assigned. */
    researchersPerRun: 20,
  },
  antimatterContainment: {
    inputs: { voidCrystals: 2 },
    outputs: { antimatter: 1 },
    /** Runs a second for each Particle Lab level (Lv.1 already runs). */
    runsPerSecPerLabLevel: 1,
  },
  darkMatterDetection: {
    inputs: { antimatter: 1 },
    outputs: { darkMatter: 1 },
    /** One run a second for every this many active space explorations. */
    explorationsPerRun: 2,
  },
  /**
   * The Particle Lab (Story 3.6: before it, nothing built one, so antimatter
   * containment could never run). Sold on BUILD with the converter. Each level
   * costs `floor(baseCost × costMultiplier^level)` of each stock: stone from
   * Dig and void crystals from expeditions or synthesis.
   */
  particleLab: {
    baseCost: { stone: 300, voidCrystals: 10 },
    costMultiplier: 1.5,
  },
} as const;
