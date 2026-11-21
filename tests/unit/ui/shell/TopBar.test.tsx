import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { TopBar } from '../../../../src/ui/shell/TopBar';

/**
 * Story 1.36: the strip's top bar (title and pause), a Preact view replacing UIRoot's. Hooks: `#top-bar`, `#pause-button`.
 * Story 2.10: whether the game is paused is session state (the resume path's), passed in, never game state.
 */
describe('TopBar', () => {
  afterEach(() => cleanup());

  it('is the page h1 and has a pause button', () => {
    const c = render(<TopBar paused={signal(false)} onTogglePause={() => {}} />).container;
    expect(c.querySelector('#top-bar h1')?.textContent).toContain('THE SWARM');
    expect(c.querySelector('#pause-button')?.getAttribute('aria-label')).toBe('Pause game');
  });

  it('the pause button calls the toggle, and shows whether the game is paused', () => {
    const toggle = vi.fn();
    const paused = signal(false);
    const c = render(<TopBar paused={paused} onTogglePause={toggle} />).container;
    const btn = c.querySelector<HTMLButtonElement>('#pause-button')!;
    const running = btn.textContent;
    fireEvent.click(btn);
    expect(toggle).toHaveBeenCalledTimes(1);
    act(() => void (paused.value = true));
    expect(btn.textContent).not.toBe(running);
    act(() => void (paused.value = false));
    expect(btn.textContent).toBe(running);
  });
});
