import { Phase } from '../../phases/phases';

/**
 * The one event line each phase reveal types in (Story 1.20, UX-DR27).
 * Terse, present tense, no later phase named: each line is shown only once its
 * own phase has been committed.
 */
export const REVEAL_LINES: Readonly<Record<Phase, string>> = {
  [Phase.EGG_LAYING]: 'A single queen, alone in the dark earth.',
  [Phase.COLONY]: 'Many legs, one mind. The colony breathes.',
  [Phase.COMBAT]: 'Something moves in the tunnels. It is not ours.',
  [Phase.EXPANSION]: 'Beyond the nest, the world is waiting.',
  [Phase.SPACE]: 'Gravity is a chain. The swarm breaks free.',
  [Phase.TRANSCENDENCE]: 'All boundaries dissolve.',
};
