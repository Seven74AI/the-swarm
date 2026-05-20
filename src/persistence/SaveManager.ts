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
 * - #21 Backup rotation: keeps 2 rotating backup slots for corruption recovery
 */
export class SaveManager {
  private static SAVE_KEY = 'the_swarm_save';
  private static BACKUP1_KEY = 'the_swarm_save_bak1';
  private static BACKUP2_KEY = 'the_swarm_save_bak2';
  private static SAVE_VERSION = 8;
  private static AUTOSAVE_INTERVAL_MS = 30_000;

  private autosaveTimer: ReturnType<typeof setInterval> | null = null;

  save(state: GameState, playTimeMs: number): void {
    const data: SaveData = {
      version: SaveManager.SAVE_VERSION,
      timestamp: Date.now(),
      playTimeMs,
      gameState: { ...state, lastSaveTimestamp: Date.now() },
    };

    try {
      const json = JSON.stringify(data);

      // Rotate backups: bak2 ← bak1 ← current ← new
      const bak1 = localStorage.getItem(SaveManager.BACKUP1_KEY);
      if (bak1 !== null) {
        localStorage.setItem(SaveManager.BACKUP2_KEY, bak1);
      }
      const current = localStorage.getItem(SaveManager.SAVE_KEY);
      if (current !== null) {
        localStorage.setItem(SaveManager.BACKUP1_KEY, current);
      }

      localStorage.setItem(SaveManager.SAVE_KEY, json);
    } catch (e) {
      console.warn('SaveManager: Failed to save.', e);
    }
  }

  load(): { gameState: GameState; playTimeMs: number; timestamp?: number } | null {
    // Try primary save first
    const result = this.tryLoadKey(SaveManager.SAVE_KEY);
    if (result) {
      // Inject defaults for fields added in newer versions
      return this.applyDefaults(result);
    }

    // Try backup 1
    const bak1 = this.tryLoadKey(SaveManager.BACKUP1_KEY);
    if (bak1) {
      console.warn('SaveManager: Primary save corrupted, loaded from backup 1.');
      return this.applyDefaults(bak1);
    }

    // Try backup 2
    const bak2 = this.tryLoadKey(SaveManager.BACKUP2_KEY);
    if (bak2) {
      console.warn('SaveManager: Primary and backup 1 corrupted, loaded from backup 2.');
      return this.applyDefaults(bak2);
    }

    return null;
  }

  /**
   * Apply defaults for fields that may be missing from older save versions.
   * This allows backward compat without breaking existing saves.
   */
  private applyDefaults(result: { gameState: GameState; playTimeMs: number; timestamp?: number }): { gameState: GameState; playTimeMs: number; timestamp?: number } {
    const gs = result.gameState;
    if (!gs.prestige) {
      return {
        ...result,
        gameState: {
          ...gs,
          prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 0 },
        },
      };
    }
    return result;
  }

  private tryLoadKey(key: string): { gameState: GameState; playTimeMs: number; timestamp?: number } | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const data: SaveData = JSON.parse(raw);

      // Validate structure
      if (
        typeof data.version !== 'number' ||
        typeof data.timestamp !== 'number' ||
        !data.gameState ||
        typeof data.gameState !== 'object'
      ) {
        return null;
      }

      return {
        gameState: data.gameState,
        playTimeMs: data.playTimeMs ?? 0,
        timestamp: data.timestamp,
      };
    } catch {
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
    localStorage.removeItem(SaveManager.BACKUP1_KEY);
    localStorage.removeItem(SaveManager.BACKUP2_KEY);
  }
}
