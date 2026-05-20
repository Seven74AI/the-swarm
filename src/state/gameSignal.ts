import { signal } from '@preact/signals-core';
import { createInitialState, type GameState } from './GameState';

/**
 * Global reactive game state.
 *
 * Usage:
 *   // Read (anywhere, synchronously):
 *   const eggs = gameState.value.resources.eggs
 *
 *   // Write (triggers all effects that read the changed path):
 *   gameState.value = { ...gameState.value, resources: { ...eggs: 99 } }
 *
 *   // React to changes (auto-tracks which paths you read):
 *   effect(() => {
 *     console.log('Eggs changed:', gameState.value.resources.eggs)
 *   })
 *
 * Replaces the old StateManager + Store duo.
 */
export const gameState = signal<GameState>(createInitialState());
