import { log } from '../utils/log';
import type { GameState } from '../state/GameState';
import { createInitialState } from '../state/GameState';
import { Phase } from '../phases/phases';
import { migrateSave } from './migrations';
import { emptyChronicle, normalizeChronicle, type ChronicleSave } from '../state/chronicle';
import { isEnemyType, type EnemyType } from '../data/content/enemies';
import { peekEnemy } from '../systems/EnemySystem';
import type { BackupSlot, LoadResult, SaveStore } from '../platform/storage/SaveStore';

export interface SaveData {
  version: number;
  timestamp: number;
  playTimeMs: number;
  gameState: GameState;
  /** The event lines (Story 1.26, ADR 0018), beside the game state. From v17. */
  chronicle?: ChronicleSave;
  /**
   * Wall-clock ms the saved state was last simulated to (Story 2.3, D1): the
   * moment the page hid, or the write time while it runs. From v20. The
   * resume path measures the gap from it, never from the write time, so a
   * save written while hidden doesn't swallow the hidden time.
   */
  lastSeenAt?: number;
}

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
  /** When the saved state was last simulated to (wall clock); null if the save doesn't say. */
  lastSeenAt: number | null;
  chronicle: ChronicleSave;
}

/** What `open()` found (Story 2.2): the store's load status, decoded saves in place of text. */
export type SaveLoad = LoadResult<LoadedSave>;

/**
 * The largest file IMPORT SAVE reads, in characters (Story 2.11). A real save is
 * well under 100 KB; anything this big is not one, and is refused unparsed.
 */
export const MAX_IMPORT_CHARS = 5_000_000;

/** Why an imported file was refused (Story 2.11, UX-DR33). */
export type ImportRefusal = 'not_a_save' | 'newer_version';

/** What `readImport()` made of a file: the save, migrated to this version, or why it isn't one. */
export type ImportRead =
  | { readonly ok: true; readonly save: LoadedSave }
  | { readonly ok: false; readonly reason: ImportRefusal; readonly version?: number };

/** Thrown by `decode` for a save newer than this build, so import can say so. */
class NewerSaveError extends Error {
  constructor(readonly version: number) {
    super(`save version ${version} is newer than this build (${SaveManager.SAVE_VERSION})`);
  }
}

const PHASES: ReadonlySet<string> = new Set(Object.values(Phase));

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
  static readonly SAVE_VERSION = 29;
  private static AUTOSAVE_INTERVAL_MS = 30_000;
  /** Minimum interval between action-triggered saves (5 seconds). */
  private static ACTION_SAVE_INTERVAL_MS = 5_000;

  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  /** Timestamp of the last save triggered by a user action (not autosave/beforeunload). */
  private lastActionSaveTimestamp = 0;
  /** Where the event lines come from (main: the chronicle, Story 1.26). */
  private chronicleSource: (() => ChronicleSave) | null = null;
  /** When the state being saved was last simulated to (main: the resume path, Story 2.3). */
  private seenAtSource: (() => number) | null = null;

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

  /** Every save from now on writes the lastSeenAt this returns (Story 2.3); default: the write time. */
  setSeenAtSource(source: () => number): void {
    this.seenAtSource = source;
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
      lastSeenAt: this.seenAtSource ? this.seenAtSource() : Date.now(),
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

  /**
   * IMPORT SAVE, step 1 (Story 2.11): what `text` is. A save of any shipped
   * version is migrated to this one and decoded exactly as a load would; a file
   * that isn't a swarm save (bad JSON, a wrong shape, an unknown phase, a
   * migration that throws, a version newer than this build) is refused. Never
   * writes anything.
   */
  readImport(text: string): ImportRead {
    if (typeof text !== 'string' || text.length > MAX_IMPORT_CHARS) return { ok: false, reason: 'not_a_save' };
    try {
      return { ok: true, save: this.decode(text) };
    } catch (e) {
      if (e instanceof NewerSaveError) return { ok: false, reason: 'newer_version', version: e.version };
      log.info('save', 'import refused: not a swarm save', e);
      return { ok: false, reason: 'not_a_save' };
    }
  }

  /**
   * IMPORT SAVE, step 2 (Story 2.11), after the player confirms: write `save`
   * as THE save, with its own chronicle and play time. The replaced run rotates
   * into the first backup. From then on every save is held, so nothing this
   * session still runs (autosave, pagehide, beforeunload) can overwrite the
   * import before main reloads into it. Its lastSeenAt is now: the run resumes
   * where the file left off, with no offline time for the file's age.
   * Returns false, holding nothing, if storage refused the write.
   */
  replaceWith(save: LoadedSave): boolean {
    const now = Date.now();
    const data: SaveData = {
      version: SaveManager.SAVE_VERSION,
      timestamp: now,
      playTimeMs: save.playTimeMs,
      gameState: { ...save.gameState, lastSaveTimestamp: now },
      chronicle: save.chronicle,
      lastSeenAt: now,
    };
    try {
      this.store.write(JSON.stringify(data));
    } catch (e) {
      log.warn('save', 'import could not be written', e);
      return false;
    }
    this.held = true;
    return true;
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
      throw new NewerSaveError(data.version);
    }
    const migrated = migrateSave(data, data.version, SaveManager.SAVE_VERSION);
    const gs = migrated.gameState as Partial<GameState> | null;
    if (
      !gs ||
      typeof gs !== 'object' ||
      typeof gs.phase !== 'string' ||
      !PHASES.has(gs.phase) ||
      !gs.resources ||
      typeof gs.resources !== 'object' ||
      Array.isArray(gs.resources)
    ) {
      throw new Error('not a save: no known phase or resources');
    }
    return this.applyDefaults({
      gameState: migrated.gameState,
      playTimeMs: migrated.playTimeMs ?? 0,
      timestamp: migrated.timestamp,
      lastSeenAt: migrated.lastSeenAt,
      chronicle: migrated.chronicle,
    });
  }

  /**
   * Apply defaults for fields that may be missing from older save versions.
   * Deep-merges the loaded game state with createInitialState() so any
   * missing fields get sensible defaults. The gap since lastSeenAt is resumed
   * by main through the one resume path (Story 2.3), not here.
   */
  private applyDefaults(result: {
    gameState: GameState;
    playTimeMs: number;
    timestamp?: number;
    lastSeenAt?: number;
    chronicle?: ChronicleSave;
  }): LoadedSave {
    // Deep-merge loaded state over defaults — loaded values win, missing fields get defaults
    const defaultState = createInitialState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged = deepMerge(defaultState as any, result.gameState as any) as unknown as GameState;
    // An enemy the game doesn't know would leave the enemy card blank: draw the one this save's generator gives (Story 4.1).
    const mergedState: GameState = isEnemyType(merged.nextEnemy)
      ? merged
      : { ...merged, nextEnemy: peekEnemy(merged.rng, merged.battlesWon).type as EnemyType };
    return {
      ...result,
      gameState: mergedState,
      lastSeenAt: SaveManager.seenAtOf(result, mergedState),
      chronicle: normalizeChronicle(result.chronicle),
    };
  }

  /** The save's lastSeenAt, else its old save time (a malformed field must not lose the gap). */
  private static seenAtOf(result: { timestamp?: number; lastSeenAt?: number }, gs: GameState): number | null {
    const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
    if (valid(result.lastSeenAt)) return result.lastSeenAt;
    if (valid(gs.lastSaveTimestamp)) return gs.lastSaveTimestamp;
    if (valid(result.timestamp)) return result.timestamp;
    return null;
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
