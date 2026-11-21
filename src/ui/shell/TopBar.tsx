import type { ReadonlySignal } from '@preact/signals';

/**
 * The strip's top bar (Story 1.36, moved out of UIRoot): the page's one h1
 * (Story 1.32; the ant is decoration) and the pause button, which shows
 * whether the game is paused. Hooks: `#top-bar`, `#pause-button`.
 * The pause is session state (Story 2.10): main passes it in, it is never in the game state.
 */
export function TopBar({ paused: pausedSignal, onTogglePause }: { paused: ReadonlySignal<boolean>; onTogglePause: () => void }) {
  const paused = pausedSignal.value;
  return (
    <div id="top-bar" class="top-bar">
      <h1 class="game-title">
        <span aria-hidden="true">🐜 </span>THE SWARM
      </h1>
      <button type="button" id="pause-button" class="pause-btn" aria-label="Pause game" onClick={onTogglePause}>
        {paused ? '▶' : '⏸'}
      </button>
      <span class="game-phase">Queen's Chamber</span>
    </div>
  );
}
