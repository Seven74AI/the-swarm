import type { TraitId } from './enemies';

/**
 * The words of the battle summary's cause line (Story 4.3, UX-DR25): how each
 * trait is named when it decides a fight, and how each upgrade is named. The
 * line templates are colony lines (`cause_*` in `colonyLines.ts`), filled by
 * `causeLine()` in `systems/BattleCauses.ts`: `THEIR SHELLS TURNED YOUR VENOM.`
 */

export interface CauseTraitWords {
  /** The trait as the subject: `THEIR SHELLS`. */
  readonly their: string;
  /** What it does to an upgrade it blunts: `TURNED`. */
  readonly beat: string;
}

export const CAUSE_TRAIT_WORDS: Readonly<Record<TraitId, CauseTraitWords>> = {
  swarm: { their: 'THEIR NUMBERS', beat: 'SWAMPED' },
  regrowth: { their: 'THEIR REGROWTH', beat: 'OUTLASTED' },
  web: { their: 'THEIR WEBS', beat: 'HELD' },
  thick_shell: { their: 'THEIR SHELLS', beat: 'TURNED' },
  swift: { their: 'THEIR SPEED', beat: 'OUTRAN' },
  venom_resistance: { their: 'THEIR HIDES', beat: 'SHRUGGED OFF' },
};

/** Each upgrade as the line names it: `YOUR VENOM`. */
export const CAUSE_UPGRADE_WORDS: Readonly<Record<string, string>> = {
  weapon: 'WEAPONS',
  armor: 'ARMOR',
  efficient_gatherers: 'FLANKERS',
  swift_soldiers: 'SPEED',
  accelerated_hatching: 'MENDING',
  tough_shells: 'PLATING',
  potent_venom: 'VENOM',
  reinforced_mandibles: 'MANDIBLES',
};

/** When a line names no single upgrade. */
export const CAUSE_ARMY_WORD = 'ARMY';
export const CAUSE_EQUIPMENT_WORD = 'EQUIPMENT';
