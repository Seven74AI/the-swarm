import { signal } from '@preact/signals';

/**
 * Every DIG press that lands, counted (Story 9.8): a UI signal only, not game
 * state, not saved, not on the EventBus. `DigButton` bumps it after the action
 * accepts the press; `NestSceneArea` hands it to the scene, which puffs dirt
 * at the dig face and shakes once per press (none under reduced motion).
 */
export const digPulse = signal(0);

export function pulseDig(): void {
  digPulse.value += 1;
}
