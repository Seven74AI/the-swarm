import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { createInitialState } from '../../../../src/state/GameState';
import { TopBar } from '../../../../src/ui/shell/TopBar';

/** Story 1.36: the strip's top bar (title and pause), a Preact view replacing UIRoot's. Hooks: `#top-bar`, `#pause-button`. */
describe('TopBar', () => {
  beforeEach(() => {
    gameState.value = createInitialState();
  });
  afterEach(() => cleanup());

  it('is the page h1 and has a pause button', () => {
    const c = render(<TopBar onTogglePause={() => {}} />).container;
    expect(c.querySelector('#top-bar h1')?.textContent).toContain('THE SWARM');
    expect(c.querySelector('#pause-button')?.getAttribute('aria-label')).toBe('Pause game');
  });

  it('the pause button calls the toggle, and shows whether the game is paused', () => {
    const toggle = vi.fn();
    const c = render(<TopBar onTogglePause={toggle} />).container;
    const btn = c.querySelector<HTMLButtonElement>('#pause-button')!;
    const running = btn.textContent;
    fireEvent.click(btn);
    expect(toggle).toHaveBeenCalledTimes(1);
    act(() => void (gameState.value = { ...gameState.value, paused: true }));
    expect(btn.textContent).not.toBe(running);
    act(() => void (gameState.value = { ...gameState.value, paused: false }));
    expect(btn.textContent).toBe(running);
  });
});
