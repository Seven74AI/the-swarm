export enum Phase {
  EGG_LAYING = 'egg_laying',
  COLONY = 'colony',
  COMBAT = 'combat',
}

/** Ordered list of phases for progression checking. */
export const PHASE_ORDER: Phase[] = [Phase.EGG_LAYING, Phase.COLONY, Phase.COMBAT];
