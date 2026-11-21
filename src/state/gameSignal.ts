import { signal } from '@preact/signals-core';
import { createInitialState, type GameState } from './GameState';

/**
 * Global reactive game state: one signal, one spread-based write per tick (ADR 0001).
 *
 * Read it in the UI through the `computed` slices in `./selectors.ts`, never `gameState.value`:
 * an effect that reads `gameState.value.x` re-runs on every write, 20 times a second (#186).
 * Game code (systems, the tick loop, actions) reads `gameState.value` and writes a new object:
 *
 *   gameState.value = { ...s, resources: { ...s.resources, eggs: s.resources.eggs + 1 } };
 *
 * Keep untouched slices' references: that is what keeps their selectors quiet.
 */
export const gameState = signal<GameState>(createInitialState());
