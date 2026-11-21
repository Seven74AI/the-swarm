/**
 * The save store (Story 2.2; AR6, architecture D4).
 *
 * Where the save text lives: one primary slot and a 2-slot rotating backup
 * (the keys the game has always used), plus one more key that keeps a save
 * that couldn't be read. Game code never touches `localStorage` itself
 * (tests/arch/architecture.test.ts); a Capacitor build would swap in its own
 * `SaveStore` here.
 *
 * `load(decode)` never resets anything. It tells the caller what it found:
 * - `ok`: the primary decoded.
 * - `recoveredFromBackup`: there is no primary, but a backup decoded.
 * - `unreadable`: a save exists but `decode` threw on it (bad JSON, an unknown
 *   version, a failing migration). Its text is copied aside under
 *   `SAVE_KEYS.unreadable`, the newest readable backup (if any) is offered, and
 *   no slot is changed: the player chooses what happens next.
 * - `empty`: nothing was ever saved.
 *
 * The decoder comes from the caller (persistence/), so platform/ needs no
 * game code.
 */

/** The localStorage keys (the first three are the ones every earlier build wrote). */
export const SAVE_KEYS = Object.freeze({
  primary: 'the_swarm_save',
  backup1: 'the_swarm_save_bak1',
  backup2: 'the_swarm_save_bak2',
  /** A save that couldn't be read, kept as it was until the player is done with it. */
  unreadable: 'the_swarm_save_unreadable',
});

export type BackupSlot = 'backup1' | 'backup2';
const BACKUPS: readonly BackupSlot[] = ['backup1', 'backup2'];

export type LoadStatus = 'ok' | 'recoveredFromBackup' | 'unreadable' | 'empty';

export interface LoadResult<T> {
  readonly status: LoadStatus;
  /** The decoded save: set for `ok` and `recoveredFromBackup`. */
  readonly state?: T;
  /** `recoveredFromBackup`: the slot it came from. */
  readonly slot?: BackupSlot;
  /** `unreadable`: the newest backup that does decode, if there is one. */
  readonly backup?: { readonly slot: BackupSlot; readonly state: T };
  /** `unreadable`: the text that couldn't be read. */
  readonly raw?: string;
  /** `unreadable`: what the decoder threw. */
  readonly error?: unknown;
}

export interface SaveStore {
  /** Read the save; see the file comment for what each status means. Never writes a slot. */
  load<T>(decode: (text: string) => T): LoadResult<T>;
  /** Rotate (backup 2 ← backup 1 ← primary) and write `text` as the primary. Throws if storage refuses. */
  write(text: string): void;
  /** Make a backup the primary (LOAD BACKUP). Throws if storage refuses. */
  restore(slot: BackupSlot): void;
  /** Drop the primary only (START OVER, before the fresh run's first write). */
  discardPrimary(): void;
  /** Remove the save and its backups. The unreadable copy stays. */
  clear(): void;
  /** The text of the last save that couldn't be read, or null. */
  unreadable(): string | null;
}

/** What the store needs from `localStorage`. */
export interface RemovableStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const NO_STORAGE = 'save storage is unavailable';

export function createLocalSaveStore(storage: RemovableStore | null): SaveStore {
  const get = (key: string): string | null => {
    try {
      return storage ? storage.getItem(key) : null;
    } catch {
      return null;
    }
  };
  const set = (key: string, value: string): void => {
    if (!storage) throw new Error(NO_STORAGE);
    storage.setItem(key, value);
  };
  const remove = (key: string): void => {
    try {
      storage?.removeItem(key);
    } catch {
      // Nothing to do: the key stays, and the next load reads it again.
    }
  };

  function tryDecode<T>(text: string, decode: (text: string) => T): { ok: true; state: T } | { ok: false; error: unknown } {
    try {
      return { ok: true, state: decode(text) };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function keepAside(text: string): void {
    try {
      if (get(SAVE_KEYS.unreadable) !== text) set(SAVE_KEYS.unreadable, text);
    } catch {
      // Storage is full: the text is still in its own slot, which nothing overwrites until the player chooses.
    }
  }

  return {
    load<T>(decode: (text: string) => T): LoadResult<T> {
      const primary = get(SAVE_KEYS.primary);
      let firstError: { raw: string; error: unknown } | null = null;
      if (primary !== null) {
        const r = tryDecode(primary, decode);
        if (r.ok) return { status: 'ok', state: r.state };
        firstError = { raw: primary, error: r.error };
      }
      let backup: { slot: BackupSlot; state: T } | undefined;
      for (const slot of BACKUPS) {
        const text = get(SAVE_KEYS[slot]);
        if (text === null) continue;
        const r = tryDecode(text, decode);
        if (r.ok) {
          backup = { slot, state: r.state };
          break;
        }
        firstError ??= { raw: text, error: r.error };
      }
      if (primary === null && backup) return { status: 'recoveredFromBackup', state: backup.state, slot: backup.slot };
      if (firstError) {
        keepAside(firstError.raw);
        return { status: 'unreadable', raw: firstError.raw, error: firstError.error, ...(backup ? { backup } : {}) };
      }
      return { status: 'empty' };
    },

    write(text) {
      const bak1 = get(SAVE_KEYS.backup1);
      if (bak1 !== null) set(SAVE_KEYS.backup2, bak1);
      const current = get(SAVE_KEYS.primary);
      if (current !== null) set(SAVE_KEYS.backup1, current);
      set(SAVE_KEYS.primary, text);
    },

    restore(slot) {
      const text = get(SAVE_KEYS[slot]);
      if (text === null) throw new Error(`no ${slot} to restore`);
      set(SAVE_KEYS.primary, text);
    },

    discardPrimary() {
      remove(SAVE_KEYS.primary);
    },

    clear() {
      remove(SAVE_KEYS.primary);
      remove(SAVE_KEYS.backup1);
      remove(SAVE_KEYS.backup2);
    },

    unreadable() {
      return get(SAVE_KEYS.unreadable);
    },
  };
}
