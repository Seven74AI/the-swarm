import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { createInitialState } from '../../../../src/state/GameState';
import { FoodStock } from '../../../../src/ui/wrkr/FoodStock';
import { formatFull } from '../../../../src/utils/format';

/** Story 1.36: WRKR's food stock line, a Preact view replacing the legacy FoodDisplay. */
describe('FoodStock', () => {
  beforeEach(() => {
    gameState.value = createInitialState();
  });
  afterEach(() => cleanup());

  it('shows the food stock, and follows it', () => {
    const c = render(<FoodStock />).container;
    const value = () => c.querySelector('.stat-value')?.textContent;
    expect(value()).toBe(formatFull(gameState.value.resources.food));
    const more = gameState.value.resources.food + 1234;
    act(() => {
      gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, food: more } };
    });
    expect(value()).toBe(formatFull(more));
  });

  it('has a section heading', () => {
    const c = render(<FoodStock />).container;
    expect(c.querySelector('h2.panel-title')?.textContent).toBe('Food');
  });
});
