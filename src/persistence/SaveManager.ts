import { log } from '../utils/log';
import type { GameState } from '../state/GameState';
import { createInitialState } from '../state/GameState';
import { calculateOfflineTicks } from '../systems/OfflineProgression';
import { migrateSave } from './migrations';
import { emptyChronicle, normalizeChronicle, type ChronicleSave } from '../state/chronicle';
import type { BackupSlot, LoadResult, SaveStore } from '../platform/storage/SaveStore';

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

/** A decoded save: what `load()` gives main. */
export interface LoadedSave {
  gameState: GameState;
  playTimeMs: number;
  timestamp?: number;
  offline: OfflineLoadInfo | null;
  chronicle: ChronicleSave;
}

/** What `open()` found (Story 2.2): the store's load status, decoded saves in place of text. */
export type SaveLoad = LoadResult<LoadedSave>;

/**
 * SaveManager: the save format (version, migrations, defaults, offline info)
 * over a `SaveStore` (Story 2.2, D4), with autosave.
 *
 * - Saves every 30s, on meaningful actions (at most every 5s) and on demand.
 * - A save that can't be read (bad JSON, a newer version, a migration that
 *   throws) is never reset: `open()` reports it as `unreadable`, and every save
 *   is refused (`isHeld()`) until the player picks LOAD BACKUP (`loadBackup`)
 *   or START OVER (`startOver`).
 * - A failed write leaves the last good save as it was and is reported through
 *   `onSaveStatus` until the next write succeeds.
 */
export class SaveManager {
  /** The save format's version; each step up has a migration in migrations.ts. */
  static readonly SAVE_VERSION = 19;
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
  /** Told each time saving goes from working to failing (true) or back (false) (Story 2.2). */
  private statusListeners: ((failing: boolean) => void)[] = [];
  /** The last save attempt failed; the listener is told again only after a save succeeds. */
  private failing = false;
  /** The save on disk couldn't be read: nothing is written until the player chooses (Story 2.2). */
  private held = false;

  constructor(private readonly store: SaveStore) {}

  /** Call `listener` each time saving goes from working to failing (storage full or blocked). */
  onSaveFailed(listener: () => void): void {
    this.saveFailedListener = listener;
  }

  /** Call `listener(true)` when saving starts failing and `listener(false)` once a write succeeds again. */
  onSaveStatus(listener: (failing: boolean) => void): void {
    this.statusListeners.push(listener);
  }

  /** The last write failed (and no write has succeeded since). */
  isFailing(): boolean {
    return this.failing;
  }

  /** The save couldn't be read, so every save is refused until LOAD BACKUP or START OVER. */
  isHeld(): boolean {
    return this.held;
  }

  /** Every save from now on writes the chronicle this returns (Story 1.26). */
  setChronicleSource(source: () => ChronicleSave): void {
    this.chronicleSource = source;
  }

  /**
   * Save the game state with backup rotation.
   *
   * @param force - If true, bypasses the action-save rate limit.
   *                Autosave and beforeunload use force=true.
   *                User actions (clicks, battles, etc.) use force=false.
   * @returns true if saved; false if skipped (rate limit, unreadable save held) or failed.
   */
  save(state: GameState, playTimeMs: number, force = false): boolean {
    if (this.held) return false;
    if (!force) {
      const now = Date.now();
      if (now - this.lastActionSaveTimestamp < SaveManager.ACTION_SAVE_INTERVAL_MS) {
        return false;
      }
      this.lastActionSaveTimestamp = now;
    }
    try {
      this.store.write(this.serialize(state, playTimeMs));
      this.setFailing(false);
      return true;
    } catch (e) {
      log.warn('save', 'failed to save', e);
      this.setFailing(true);
      return false;
    }
  }

  private setFailing(failing: boolean): void {
    if (failing === this.failing) return;
    this.failing = failing;
    if (failing) this.saveFailedListener?.();
    for (const listener of this.statusListeners) listener(failing);
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

  /**
   * Read the save and say what was found (Story 2.2). `unreadable` holds every
   * save until the player chooses; `recoveredFromBackup` is logged as a warning.
   */
  open(): SaveLoad {
    const result = this.store.load((text) => this.decode(text));
    if (result.status === 'unreadable') {
      this.held = true;
      log.warn('save', 'the save could not be read; holding every save until the player chooses', result.error);
    } else if (result.status === 'recoveredFromBackup') {
      log.warn('save', 'no primary save; loaded the backup', result.slot);
    }
    return result;
  }

  /** The decoded save, or null when there is none or it can't be read (see `open()` for which). */
  load(): LoadedSave | null {
    return this.open().state ?? null;
  }

  /** LOAD BACKUP: make `slot` the save (still held: main reloads and boots from it). */
  loadBackup(slot: BackupSlot): boolean {
    try {
      this.store.restore(slot);
      return true;
    } catch (e) {
      log.warn('save', 'could not restore the backup', e);
      return false;
    }
  }

  /** START OVER: drop the unreadable save (its copy stays aside), stop holding, write the fresh run. */
  startOver(state: GameState, playTimeMs: number): boolean {
    this.store.discardPrimary();
    this.held = false;
    return this.save(state, playTimeMs, true);
  }

  /** The text of the last save that couldn't be read (kept aside), or null. */
  unreadableText(): string | null {
    return this.store.unreadable();
  }

  /**
   * Text → save, or throw: bad JSON, a malformed envelope, a version newer
   * than this build, or a migration that throws all make the save unreadable.
   */
  private decode(text: string): LoadedSave {
    const data = JSON.parse(text) as SaveData;
    if (
      data === null ||
      typeof data !== 'object' ||
      !Number.isInteger(data.version) ||
      data.version < 1 ||
      typeof data.timestamp !== 'number' ||
      !data.gameState ||
      typeof data.gameState !== 'object'
    ) {
      throw new Error('not a save');
    }
    if (data.version > SaveManager.SAVE_VERSION) {
      throw new Error(`save version ${data.version} is newer than this build (${SaveManager.SAVE_VERSION})`);
    }
    const migrated = migrateSave(data, data.version, SaveManager.SAVE_VERSION);
    return this.applyDefaults({
      gameState: migrated.gameState,
      playTimeMs: migrated.playTimeMs ?? 0,
      timestamp: migrated.timestamp,
      chronicle: migrated.chronicle,
    });
  }

  /**
   * Apply defaults for fields that may be missing from older save versions.
   * Deep-merges the loaded game state with createInitialState() so any
   * missing fields get sensible defaults. Also computes offline progression.
   */
  private applyDefaults(result: { gameState: GameState; playTimeMs: number; timestamp?: number; chronicle?: ChronicleSave }): LoadedSave {
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
    this.store.clear();
  }
}
