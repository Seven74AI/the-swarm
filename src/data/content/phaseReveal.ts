import { Phase } from '../../phases/phases';

/**
 * The one event line each phase reveal types in (Story 1.20, UX-DR27).
 * A colony line (upper case, present tense; Story 1.33), no later phase named: each line is shown only once its
 * own phase has been committed.
 */
export const REVEAL_LINES: Readonly<Record<Phase, string>> = {
  [Phase.EGG_LAYING]: 'A SINGLE QUEEN, ALONE IN THE DARK EARTH.',
  [Phase.COLONY]: 'MANY LEGS, ONE MIND. THE COLONY BREATHES.',
  [Phase.COMBAT]: 'SOMETHING MOVES IN THE TUNNELS. IT IS NOT OURS.',
  [Phase.EXPANSION]: 'BEYOND THE NEST, THE WORLD WAITS.',
  [Phase.SPACE]: 'GRAVITY IS A CHAIN. THE SWARM BREAKS FREE.',
  [Phase.TRANSCENDENCE]: 'ALL BOUNDARIES DISSOLVE.',
};

/**
 * Each phase's name on the phase line and in the reveal (kept from
 * PhaseIndicator; E2E specs read it). A phase's name is shown only once the
 * phase has been entered (UX-DR42).
 */
export const PHASE_TITLES: Readonly<Record<Phase, string>> = {
  [Phase.EGG_LAYING]: 'The Lonely Queen',
  [Phase.COLONY]: 'The Colony',
  [Phase.COMBAT]: 'The War',
  [Phase.EXPANSION]: 'The Expansion',
  [Phase.SPACE]: 'The Space Age',
  [Phase.TRANSCENDENCE]: 'Transcendence',
};
