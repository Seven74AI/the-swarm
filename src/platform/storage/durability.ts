/**
 * Save durability (Story 2.12; AR6, architecture D4 → Durability).
 *
 * Two things keep a browser from deleting a run:
 * - `navigator.storage.persist()`, asked once after the first meaningful play.
 *   The ask is remembered under its own key (outside the save), so a later
 *   load never asks again: Firefox shows a prompt for it. Storage that is
 *   already persistent is never asked.
 * - A one-time hint to add the game to the home screen: Safari deletes a
 *   site's storage after 7 days without a visit, but not a home-screen web
 *   app's. Wanted only on a mobile browser that isn't the installed app, and
 *   remembered under its own key once shown.
 *
 * Nothing here throws or rejects: a missing or failing API is an outcome.
 * main calls it and logs the result (platform/ can't import `utils/log`).
 */
import type { Capabilities } from '../capabilities';
import type { RemovableStore } from './SaveStore';

/** Set once `persist()` was asked; holds the answer. */
export const PERSIST_KEY = 'the_swarm_storage_persist';
/** Set once the add-to-home-screen hint was shown. */
export const HOME_HINT_KEY = 'the_swarm_home_hint';

/**
 * What a persist request came to:
 * - `granted` / `denied`: the browser's answer to this ask.
 * - `already`: the storage was persistent before; nothing was asked.
 * - `asked`: an earlier load asked already; nothing was asked now.
 * - `unsupported`: no `navigator.storage.persist`.
 * - `failed`: the API threw or rejected.
 */
export type PersistOutcome = 'granted' | 'denied' | 'already' | 'asked' | 'unsupported' | 'failed';

/** The parts of `navigator.storage` used here; a plain object in tests. */
export interface StorageManagerLike {
  readonly persist?: () => Promise<boolean>;
  readonly persisted?: () => Promise<boolean>;
}

export interface Durability {
  /** Ask for persistent storage (at most once; later calls return the first outcome). Never rejects. */
  requestPersist(): Promise<PersistOutcome>;
  /** The outcome of this session's request, or null before one was made. */
  status(): PersistOutcome | null;
  /** A mobile browser, not the installed app, and the hint not yet shown. */
  wantsHomeScreenHint(): boolean;
  markHomeScreenHintSeen(): void;
}

export interface DurabilityDeps {
  readonly storageManager: StorageManagerLike | undefined;
  readonly storage: RemovableStore | null;
  readonly capabilities: Capabilities;
}

const SEEN = 'seen';

export function createDurability({ storageManager, storage, capabilities }: DurabilityDeps): Durability {
  const read = (key: string): string | null => {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string): void => {
    try {
      storage?.setItem(key, value);
    } catch {
      // Storage is blocked or full: it lasts the session.
    }
  };

  let request: Promise<PersistOutcome> | null = null;
  let outcome: PersistOutcome | null = null;
  let hintSeen = false;

  const ask = async (): Promise<PersistOutcome> => {
    if (read(PERSIST_KEY) !== null) return 'asked';
    if (typeof storageManager?.persist !== 'function') return 'unsupported';
    try {
      if (typeof storageManager.persisted === 'function' && (await storageManager.persisted())) return 'already';
      const granted = await storageManager.persist();
      const answer: PersistOutcome = granted ? 'granted' : 'denied';
      write(PERSIST_KEY, answer);
      return answer;
    } catch {
      return 'failed';
    }
  };

  return {
    requestPersist() {
      if (request === null) {
        request = ask().then((o) => {
          outcome = o;
          return o;
        });
      }
      return request;
    },
    status: () => outcome,
    wantsHomeScreenHint() {
      if (!capabilities.mobile || capabilities.standalone) return false;
      return !hintSeen && read(HOME_HINT_KEY) === null;
    },
    markHomeScreenHintSeen() {
      hintSeen = true;
      write(HOME_HINT_KEY, SEEN);
    },
  };
}
