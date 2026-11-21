import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SaveManager, MAX_IMPORT_CHARS, type LoadedSave } from '../../../src/persistence/SaveManager';
import { createLocalSaveStore, SAVE_KEYS } from '../../../src/platform/storage/SaveStore';
import { createSettingsStore, SETTINGS_KEY } from '../../../src/platform/settings';
import { createIntroFlag, INTRO_FLAG_KEY } from '../../../src/platform/storage/introFlag';
import { createInitialState } from '../../../src/state/GameState';
import { createChronicle } from '../../../src/state/chronicle';
import { Phase } from '../../../src/phases/phases';

/**
 * Story 2.11 (AR6, UX-DR32, UX-DR33): export and import a save.
 *
 * - The exported file is the save: the game state and its envelope (chronicle,
 *   play time), never the settings or the intro flag.
 * - A file that isn't a swarm save (bad JSON, a wrong shape, a version newer
 *   than this build, a migration that throws) is refused, and nothing changes.
 * - A valid file of ANY shipped version is migrated to the current version
 *   before it loads, and round-trips: export → import gives the same run.
 */

const SAVES_DIR = path.join(__dirname, '..', '..', 'saves');
const fixtures = fs
  .readdirSync(SAVES_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((file) => ({ file, text: fs.readFileSync(path.join(SAVES_DIR, file), 'utf-8') }));

const caps = { vibrate: true, standalone: false, reducedMotion: false, moreContrast: false };
const PHASES = new Set<string>(Object.values(Phase));

function manager() {
  return new SaveManager(createLocalSaveStore(localStorage));
}

/** Everything the game keeps in localStorage, to show nothing changed. */
function snapshotStorage(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    out[k] = localStorage.getItem(k);
  }
  return out;
}

function imported(m: SaveManager, text: string): LoadedSave {
  const r = m.readImport(text);
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r.save;
}

beforeEach(() => localStorage.clear());

describe('export: the file is the save, not the settings or the intro flag', () => {
  it('holds the game state and the chronicle', () => {
    const m = manager();
    const chronicle = createChronicle();
    chronicle.add('THE QUEEN LAYS.');
    m.setChronicleSource(() => chronicle.snapshot());
    const state = { ...createInitialState(), phase: Phase.COLONY };
    const text = m.serialize(state, 1234);
    const back = imported(manager(), text);
    expect(back.gameState.phase).toBe(Phase.COLONY);
    expect(back.playTimeMs).toBe(1234);
    expect(back.chronicle.entries.map((e) => e.message)).toContain('THE QUEEN LAYS.');
  });

  it('carries no settings and no intro flag, even when both are set', () => {
    const settings = createSettingsStore({ storage: localStorage, capabilities: caps });
    settings.update({ sound: true, crt: 'full', layMode: 'toggle' });
    const flag = createIntroFlag(localStorage);
    flag.markDone();
    const text = manager().serialize(createInitialState(), 0);
    expect(text).not.toContain(SETTINGS_KEY);
    expect(text).not.toContain('layMode');
    expect(text).not.toContain('crt');
    expect(flag.done()).toBe(true);
    expect(text).not.toContain(INTRO_FLAG_KEY);
    expect(text).not.toContain('onboarding');
  });
});

describe('import: every shipped save version is accepted and migrated', () => {
  it('there is a fixture for every version before this one', () => {
    const versions = new Set(fixtures.map((f) => (JSON.parse(f.text) as { version: number }).version));
    for (let v = 1; v < SaveManager.SAVE_VERSION; v++) expect(versions.has(v), `v${v}`).toBe(true);
  });

  it.each(fixtures)('$file imports, migrated to the current version', ({ text }) => {
    const save = imported(manager(), text);
    expect(PHASES.has(save.gameState.phase)).toBe(true);
    expect(save.gameState.resources).toBeTypeOf('object');
    // Loaded through the current build's defaults: every top-level key the current state has.
    for (const key of Object.keys(createInitialState())) expect(save.gameState, key).toHaveProperty(key);
  });

  it.each(fixtures)('$file round-trips: import → export → import gives the same run', ({ text }) => {
    const m = manager();
    const first = imported(m, text);
    const chronicle = createChronicle(first.chronicle);
    m.setChronicleSource(() => chronicle.snapshot());
    const exported = m.serialize(first.gameState, first.playTimeMs);
    expect((JSON.parse(exported) as { version: number }).version).toBe(SaveManager.SAVE_VERSION);
    const second = imported(manager(), exported);
    const { lastSaveTimestamp: _a, ...a } = first.gameState;
    const { lastSaveTimestamp: _b, ...b } = second.gameState;
    expect(b).toEqual(a);
    expect(second.playTimeMs).toBe(first.playTimeMs);
    expect(second.chronicle).toEqual(first.chronicle);
  });

  it.each(fixtures)('$file replaces the stored run, which then loads as the imported one', ({ text }) => {
    const m = manager();
    m.save({ ...createInitialState(), phase: Phase.EGG_LAYING }, 0, true);
    const save = imported(m, text);
    expect(m.replaceWith(save)).toBe(true);
    const reopened = manager().open();
    expect(reopened.status).toBe('ok');
    const { lastSaveTimestamp: _a, ...a } = reopened.state!.gameState;
    const { lastSaveTimestamp: _b, ...b } = save.gameState;
    expect(a).toEqual(b);
    expect(reopened.state!.chronicle).toEqual(save.chronicle);
  });
});

describe('import: a file that is not a swarm save changes nothing', () => {
  const current = () => manager().serialize({ ...createInitialState(), phase: Phase.COLONY }, 99);
  const future = () => {
    const d = JSON.parse(current()) as { version: number };
    d.version = SaveManager.SAVE_VERSION + 1;
    return JSON.stringify(d);
  };
  const cases: [string, () => string, 'not_a_save' | 'newer_version'][] = [
    ['empty text', () => '', 'not_a_save'],
    ['not JSON', () => '{"version": 3, "gameS', 'not_a_save'],
    ['a JSON number', () => '42', 'not_a_save'],
    ['JSON null', () => 'null', 'not_a_save'],
    ['an array', () => '[1,2,3]', 'not_a_save'],
    ['another app’s JSON', () => JSON.stringify({ name: 'package', version: '1.0.0' }), 'not_a_save'],
    ['no game state', () => JSON.stringify({ version: 5, timestamp: 1 }), 'not_a_save'],
    ['a fractional version', () => JSON.stringify({ ...JSON.parse(current()), version: 2.5 }), 'not_a_save'],
    ['version 0', () => JSON.stringify({ ...JSON.parse(current()), version: 0 }), 'not_a_save'],
    [
      'an unknown phase',
      () => {
        const d = JSON.parse(current()) as { gameState: { phase: string } };
        d.gameState.phase = 'not_a_phase';
        return JSON.stringify(d);
      },
      'not_a_save',
    ],
    [
      'resources that are not an object',
      () => {
        const d = JSON.parse(current()) as { gameState: { resources: unknown } };
        d.gameState.resources = 'lots';
        return JSON.stringify(d);
      },
      'not_a_save',
    ],
    ['a file too large to be a save', () => ' '.repeat(MAX_IMPORT_CHARS + 1) + current(), 'not_a_save'],
    ['a version newer than this build', future, 'newer_version'],
  ];

  it.each(cases)('%s is refused', (_name, text, reason) => {
    const m = manager();
    m.save({ ...createInitialState(), phase: Phase.COMBAT }, 5, true);
    const before = snapshotStorage();
    const r = m.readImport(text());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(reason);
    expect(snapshotStorage()).toEqual(before);
    // The current run still loads, and saving goes on as before.
    expect(m.isHeld()).toBe(false);
    expect(manager().open().state?.gameState.phase).toBe(Phase.COMBAT);
  });

  it('a newer version says which version it is', () => {
    const r = manager().readImport(future());
    expect(r).toMatchObject({ ok: false, reason: 'newer_version', version: SaveManager.SAVE_VERSION + 1 });
  });
});

describe('replaceWith: the imported run is the save until the page reloads', () => {
  it('holds every later save, so the current run never overwrites the import', () => {
    const m = manager();
    m.save({ ...createInitialState(), phase: Phase.COMBAT }, 5, true);
    const save = imported(m, fixtures[fixtures.length - 1].text);
    expect(m.replaceWith(save)).toBe(true);
    expect(m.isHeld()).toBe(true);
    expect(m.save({ ...createInitialState(), phase: Phase.COMBAT }, 5, true)).toBe(false);
    expect(manager().open().state?.gameState.phase).toBe(save.gameState.phase);
  });

  it('keeps the replaced run as the first backup', () => {
    const m = manager();
    m.save({ ...createInitialState(), phase: Phase.COMBAT }, 5, true);
    const replaced = localStorage.getItem(SAVE_KEYS.primary);
    m.replaceWith(imported(m, fixtures[0].text));
    expect(localStorage.getItem(SAVE_KEYS.backup1)).toBe(replaced);
  });

  it('writes the imported chronicle, not the session’s', () => {
    const m = manager();
    const session = createChronicle();
    session.add('THE OLD RUN.');
    m.setChronicleSource(() => session.snapshot());
    const other = createChronicle();
    other.add('THE IMPORTED RUN.');
    const text = new SaveManager(createLocalSaveStore(null)).serialize(createInitialState(), 0);
    const save = { ...imported(m, text), chronicle: other.snapshot() };
    m.replaceWith(save);
    const lines = manager().open().state!.chronicle.entries.map((e) => e.message);
    expect(lines).toContain('THE IMPORTED RUN.');
    expect(lines).not.toContain('THE OLD RUN.');
  });

  it('a failed write leaves the current save as it was and does not hold', () => {
    const m = manager();
    m.save({ ...createInitialState(), phase: Phase.COMBAT }, 5, true);
    const before = snapshotStorage();
    const save = imported(m, fixtures[0].text);
    const full = new SaveManager({
      ...createLocalSaveStore(localStorage),
      write: () => {
        throw new Error('quota');
      },
    });
    expect(full.replaceWith(save)).toBe(false);
    expect(full.isHeld()).toBe(false);
    expect(snapshotStorage()).toEqual(before);
  });
});
