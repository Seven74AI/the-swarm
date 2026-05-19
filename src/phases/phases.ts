export enum Phase {
  EGG_LAYING = 'egg_laying',
  COLONY = 'colony',
  COMBAT = 'combat',
  EXPANSION = 'expansion',
  SPACE = 'space',
  TRANSCENDENCE = 'transcendence',
}

/** Ordered list of phases for progression checking. */
export const PHASE_ORDER: Phase[] = [Phase.EGG_LAYING, Phase.COLONY, Phase.COMBAT, Phase.EXPANSION, Phase.SPACE, Phase.TRANSCENDENCE];
