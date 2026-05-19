import type { GameState } from '../state/GameState';

export interface SaveData {
  version: number;
  timestamp: number;
  playTimeMs: number;
  gameState: GameState;
}

/**
 * SaveManager handles localStorage-based save/load with autosave.
 *
 * - Saves every 30s + on manual action
 * - Graceful handling: corrupted save → warn + fresh start
 * - Version tag for future migrations
 */
export class SaveManager {
  private static SAVE_KEY = 'the_swarm_save';
  private static SAVE_VERSION = 1;
  private static AUTOSAVE_INTERVAL_MS = 30_000;

  private autosaveTimer: ReturnType<typeof setInterval> | null = null;

  save(state: GameState, playTimeMs: number): void {
    const data: SaveData = {
      version: SaveManager.SAVE_VERSION,
      timestamp: Date.now(),
      playTimeMs,
      gameState: state,
    };

    try {
      localStorage.setItem(SaveManager.SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('SaveManager: Failed to save.', e);
    }
  }

  load(): { gameState: GameState; playTimeMs: number } | null {
    try {
      const raw = localStorage.getItem(SaveManager.SAVE_KEY);
      if (!raw) return null;

      const data: SaveData = JSON.parse(raw);

      // Validate structure
      if (
        typeof data.version !== 'number' ||
        typeof data.timestamp !== 'number' ||
        !data.gameState ||
        typeof data.gameState !== 'object'
      ) {
        console.warn('SaveManager: Invalid save data structure.');
        return null;
      }

      return {
        gameState: data.gameState,
        playTimeMs: data.playTimeMs ?? 0,
      };
    } catch (e) {
      console.warn('SaveManager: Corrupted save, starting fresh.', e);
      return null;
    }
  }

  startAutosave(getState: () => {
    state: GameState;
    playTimeMs: number;
  }): void {
    this.stopAutosave();
    this.autosaveTimer = setInterval(() => {
      const { state, playTimeMs } = getState();
      this.save(state, playTimeMs);
    }, SaveManager.AUTOSAVE_INTERVAL_MS);
  }

  stopAutosave(): void {
    if (this.autosaveTimer !== null) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  deleteSave(): void {
    localStorage.removeItem(SaveManager.SAVE_KEY);
  }
}
