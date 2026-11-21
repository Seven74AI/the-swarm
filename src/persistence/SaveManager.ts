import { log } from '../utils/log';
import type { GameState } from '../state/GameState';
import { createInitialState } from '../state/GameState';
import { calculateOfflineTicks } from '../systems/OfflineProgression';
import { migrateSave } from './migrations';
import { emptyChronicle, normalizeChronicle, type ChronicleSave } from '../state/chronicle';

export interface SaveData {
  version: number;
  timestamp: number;
  playTimeMs: number;
  gameState: GameState;
  /** The event lines (Story 1.26, ADR 0018), beside the game state. From v17. */
  chronicle?: ChronicleSave;
}

/** Offline catch-up info computed during load. null if no offline time elapsed. */
export interface OfflineLoadInfo {
  /** Raw wall-clock ms since last save (before cap) */
  elapsedMs: number;
  /** Wall-clock ms after 8h cap */
  effectiveMs: number;
  /** Number of game ticks to simulate (efficiency-reduced) */
  offlineTicks: number;
  /** Efficiency multiplier used (from save data, default 0.5) */
  efficiency: number;
}

/** Minimum absence before offline catch-up kicks in (1 second) */
const OFFLINE_MIN_MS = 1000;

/**
 * Deep-merge `loaded` into `defaults`. Scalar values from `loaded` take priority;
 * missing keys from `loaded` fall back to `defaults`. Objects are merged
 * recursively. Arrays from `loaded` replace defaults entirely.
 */
function deepMerge(defaults: Record<string, unknown>, loaded: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(loaded)) {
    const dv = defaults[key];
    const lv = loaded[key];
    if (lv !== undefined && dv !== null && typeof dv === 'object' && !Array.isArray(dv) &&
        lv !== null && typeof lv === 'object' && !Array.isArray(lv)) {
      result[key] = deepMerge(dv as Record<string, unknown>, lv as Record<string, unknown>);
    } else {
      result[key] = lv;
    }
  }
  return result;
}

/**
 * SaveManager handles localStorage-based save/load with autosave.
 *
 * - Saves every 30s + on manual action
 * - Graceful handling: corrupted save → warn + fresh start
 * - Version tag for future migrations
 * - #21 Backup rotation: keeps 2 rotating backup slots for corruption recovery
 * - #GM-8 Offline progression: computes catch-up ticks on load with efficiency
 */
export class SaveManager {
  private static SAVE_KEY = 'the_swarm_save';
  private static BACKUP1_KEY = 'the_swarm_save_bak1';
  private static BACKUP2_KEY = 'the_swarm_save_bak2';
  private static SAVE_VERSION = 18;
  private static AUTOSAVE_INTERVAL_MS = 30_000;
  /** Minimum interval between action-triggered saves (5 seconds). */
  private static ACTION_SAVE_INTERVAL_MS = 5_000;

  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  /** Timestamp of the last save triggered by a user action (not autosave/beforeunload). */
  private lastActionSaveTimestamp = 0;
  /** Where the event lines come from (main: the chronicle, Story 1.26). */
  private chronicleSource: (() => ChronicleSave) | null = null;

  /** Told when saving starts failing (Story 1.32: the player hears and sees "save failed"). */
  private saveFailedListener: (() => void) | null = null;
  /** The last save attempt failed; the listener is told again only after a save succeeds. */
  private failing = false;

  /** Call `listener` each time saving goes from working to failing (storage full or blocked). */
  onSaveFailed(listener: () => void): void {
    this.saveFailedListener = listener;
  }

  /** Every save from now on writes the chronicle this returns (Story 1.26). */
  setChronicleSource(source: () => ChronicleSave): void {
    this.chronicleSource = source;
  }

  /**
   * Save the game state to localStorage with backup rotation.
   *
   * @param force - If true, bypasses the action-save rate limit.
   *                Autosave and beforeunload use force=true.
   *                User actions (clicks, battles, etc.) use force=false.
   * @returns true if saved, false if skipped due to rate limit.
   */
  save(state: GameState, playTimeMs: number, force = false): boolean {
    if (!force) {
      const now = Date.now();
      if (now - this.lastActionSaveTimestamp < SaveManager.ACTION_SAVE_INTERVAL_MS) {
        return false;
      }
      this.lastActionSaveTimestamp = now;
    }
    try {
      const json = this.serialize(state, playTimeMs);

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
      this.failing = false;
      return true;
    } catch (e) {
      log.warn('save', 'failed to save', e);
      if (!this.failing) {
        this.failing = true;
        this.saveFailedListener?.();
      }
      return false;
    }
  }

  /**
   * The save file's text for `state`: what `save()` writes, and what EXPORT
   * SAVE offers as a file (Story 1.17; Story 2.11 builds full export/import).
   */
  serialize(state: GameState, playTimeMs: number): string {
    const data: SaveData = {
      version: SaveManager.SAVE_VERSION,
      timestamp: Date.now(),
      playTimeMs,
      gameState: { ...state, lastSaveTimestamp: Date.now() },
      chronicle: this.chronicleSource ? this.chronicleSource() : emptyChronicle(),
    };
    return JSON.stringify(data);
  }

  load(): {
    gameState: GameState;
    playTimeMs: number;
    timestamp?: number;
    offline: OfflineLoadInfo | null;
    chronicle: ChronicleSave;
  } | null {
    // Try primary save first
    const result = this.tryLoadKey(SaveManager.SAVE_KEY);
    if (result) {
      return this.applyDefaults(result);
    }

    // Try backup 1
    const bak1 = this.tryLoadKey(SaveManager.BACKUP1_KEY);
    if (bak1) {
      log.warn('save', 'primary save corrupted, loaded from backup 1');
      return this.applyDefaults(bak1);
    }

    // Try backup 2
    const bak2 = this.tryLoadKey(SaveManager.BACKUP2_KEY);
    if (bak2) {
      log.warn('save', 'primary and backup 1 corrupted, loaded from backup 2');
      return this.applyDefaults(bak2);
    }

    return null;
  }

  /**
   * Apply defaults for fields that may be missing from older save versions.
   * Deep-merges the loaded game state with createInitialState() so any
   * missing fields get sensible defaults. Also computes offline progression.
   */
  private applyDefaults(result: { gameState: GameState; playTimeMs: number; timestamp?: number; chronicle?: ChronicleSave }): {
    gameState: GameState;
    playTimeMs: number;
    timestamp?: number;
    offline: OfflineLoadInfo | null;
    chronicle: ChronicleSave;
  } {
    // Deep-merge loaded state over defaults — loaded values win, missing fields get defaults
    const defaultState = createInitialState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mergedState = deepMerge(defaultState as any, result.gameState as any);

    // Compute offline progression
    const offline = this.computeOfflineData(result, mergedState as unknown as GameState);

    return {
      ...result,
      gameState: mergedState as unknown as GameState,
      offline,
      chronicle: normalizeChronicle(result.chronicle),
    };
  }

  /**
   * Compute offline progression data from save timestamp and wall-clock time.
   * Returns null if no valid timestamp or absence < 1 second.
   */
  private computeOfflineData(
    result: { gameState: GameState; playTimeMs: number; timestamp?: number },
    gs: GameState,
  ): OfflineLoadInfo | null {
    const saveTimestamp = gs.lastSaveTimestamp || result.timestamp || 0;
    if (saveTimestamp <= 0) return null;

    const now = Date.now();
    const elapsedMs = now - saveTimestamp;

    // Only trigger offline for absences >= 1 second
    if (elapsedMs < OFFLINE_MIN_MS) return null;

    // Default to 50% if field missing (backward compat for old saves)
    const efficiency = typeof gs.offlineEfficiency === 'number' ? gs.offlineEfficiency : 0.5;
    const { effectiveMs, offlineTicks } = calculateOfflineTicks(elapsedMs, efficiency);

    // Only return if there's something to simulate
    if (offlineTicks <= 0) return null;

    return {
      elapsedMs,
      effectiveMs,
      offlineTicks,
      efficiency,
    };
  }

  private tryLoadKey(key: string): { gameState: GameState; playTimeMs: number; timestamp?: number; chronicle?: ChronicleSave } | null {
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

      // Run save migrations from loaded version to current version
      const migrated = migrateSave(data, data.version, SaveManager.SAVE_VERSION);

      return {
        gameState: migrated.gameState,
        playTimeMs: migrated.playTimeMs ?? 0,
        timestamp: migrated.timestamp,
        chronicle: migrated.chronicle,
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
      this.save(state, playTimeMs, true);
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
