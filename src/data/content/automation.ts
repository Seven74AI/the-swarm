import { Phase } from '../../phases/phases';

/**
 * The verbs the colony can take over (Story 4.10, FR16, UX-DR16; GDD
 * "Automation Systems", Pillar 3): each one the player has done by hand. A
 * target row (`KEEP [−] N [+] …` with `[AUTO]`) appears under the verb once
 * it is automatable: after `automationBalance.targets.unlockAfterManual`
 * manual performances, or from the phase after `introducedIn`.
 *
 * Hatching has no manual action: the automation research (Basic Incubation
 * and the rest) already adds an automatic laying rate, so "hatching"
 * automation is egg laying here.
 */
export type AutomationVerb = 'lay' | 'train' | 'scout' | 'warrior';

export interface AutomationVerbDef {
  readonly id: AutomationVerb;
  /** The phase whose screen holds the manual verb: the colony works it only from here on. */
  readonly introducedIn: Phase;
  /** What the target counts, after `KEEP N` (upper case): `KEEP 20 IN TRAINING`. */
  readonly keep: string;
  /** The things counted, for accessible names ("Keep one more soldier"). */
  readonly one: string;
  readonly many: string;
}

export const AUTOMATION_VERBS: readonly AutomationVerbDef[] = [
  // The brood: eggs and larvae waiting. Larvae that wait on a full nest hold it, so laying stops.
  { id: 'lay', introducedIn: Phase.EGG_LAYING, keep: 'IN THE BROOD', one: 'egg', many: 'eggs' },
  // The army: soldiers trained and in training (what upkeep is paid on, Story 4.4).
  { id: 'train', introducedIn: Phase.COMBAT, keep: 'IN TRAINING', one: 'soldier', many: 'soldiers' },
  // Scouts and warriors, at home or away on an expedition.
  { id: 'scout', introducedIn: Phase.EXPANSION, keep: 'SCOUTS', one: 'scout', many: 'scouts' },
  { id: 'warrior', introducedIn: Phase.EXPANSION, keep: 'WARRIORS', one: 'warrior', many: 'warriors' },
];

export const AUTOMATION_VERB_IDS: readonly AutomationVerb[] = AUTOMATION_VERBS.map((v) => v.id);

export function isAutomationVerb(id: unknown): id is AutomationVerb {
  return typeof id === 'string' && (AUTOMATION_VERB_IDS as readonly string[]).includes(id);
}

export function automationVerb(id: AutomationVerb): AutomationVerbDef {
  return AUTOMATION_VERBS.find((v) => v.id === id)!;
}

/** Why the colony can't reach a target right now (shown in `warn` under the row). */
export type AutomationBlock = 'food_short' | 'no_free_workers' | 'barracks_full';

/** The warn text of each reason, in the row's dim lower-case status voice (UX-DR16: `holding at 14 · food short`). */
export const AUTOMATION_BLOCK_TEXT: Readonly<Record<AutomationBlock, string>> = {
  food_short: 'food short',
  no_free_workers: 'no free workers',
  barracks_full: 'barracks full',
};
